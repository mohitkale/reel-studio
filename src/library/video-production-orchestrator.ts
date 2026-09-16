import { parseWav } from "@/lib/wav";
import { z } from "zod";
import { captureVideoSnapshot } from "@/library/video-snapshot";
import {
  videoSnapshotSchema,
  videoTakeSnapshotSchema,
  preparedVideoCompositionSchema,
  stockMediaOutputMetadata,
} from "@/production/video-snapshot";
import {
  resolveVideoStageMedia,
  videoStageHash,
} from "@/library/video-stage-media";
import { resolveReelTimeline } from "@/lib/reel-timeline";
import { resolveSpokenText } from "@/lib/spoken-text";
import { prepareVideoComposition } from "@/library/render-service";
import type { StartRenderOptions } from "@/library/render-service";
import {
  productionSignal,
  withProductionSignal,
} from "@/library/production-cancellation";
import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { promises as fs } from "node:fs";
import path from "node:path";
import { promisify } from "node:util";

import type {
  ClaimedProductionJob,
  ProductionStepKey,
} from "@/production/jobs";
import { videoProductionJobInputSchema } from "@/production/jobs";
import { runRenderNow } from "@/library/render-service";
import { prisma } from "@/library/db";
import { generateTakeFromVideoSnapshot } from "@/library/take-service";
import {
  addProductionJobOutput,
  upsertProductionJobStep,
  getProductionJobStep,
} from "@/library/repositories/production-jobs";

type Context = { signal: AbortSignal; heartbeat: () => Promise<boolean> };
type Dependencies = {
  render: (input: StartRenderOptions) => Promise<void>;
  artifact: (
    renderId: string,
  ) => Promise<{ path: string; expectsAudio: boolean }>;
  verify: (
    path: string,
    expectsAudio: boolean,
  ) => Promise<Record<string, unknown>>;
  capture: typeof captureVideoSnapshot;
  media: typeof resolveVideoStageMedia;
  load: typeof getProductionJobStep;
  step: typeof upsertProductionJobStep;
  output: typeof addProductionJobOutput;
  synthesize?: typeof generateTakeFromVideoSnapshot;
};

export async function verifyProductionMp4(
  filePath: string,
  expectsAudio: boolean,
) {
  const stats = await fs.stat(filePath);
  if (stats.size < 10_000) throw new Error("Rendered MP4 is empty");
  const { stdout } = await promisify(execFile)(
    "ffprobe",
    [
      "-v",
      "error",
      "-show_entries",
      "stream=codec_type,codec_name,width,height,duration",
      "-show_entries",
      "format=duration",
      "-of",
      "json",
      filePath,
    ],
    { signal: productionSignal() },
  );
  const probe = z
    .object({
      streams: z.array(
        z.object({
          codec_type: z.string(),
          codec_name: z.string().optional(),
          width: z.number().optional(),
          height: z.number().optional(),
          duration: z.string().optional(),
        }),
      ),
      format: z.object({ duration: z.coerce.number().finite().positive() }),
    })
    .parse(JSON.parse(stdout));
  const video = probe.streams?.find((stream) => stream.codec_type === "video");
  const audio = probe.streams?.find((stream) => stream.codec_type === "audio");
  if (
    !video ||
    !Number.isFinite(video.width) ||
    Number(video.width) < 1 ||
    !Number.isFinite(video.height) ||
    Number(video.height) < 1 ||
    Number(probe.format?.duration) <= 0
  )
    throw new Error("Rendered MP4 is not decodable");
  if (expectsAudio && !audio)
    throw new Error("Rendered MP4 is missing expected audio");
  const checksum = createHash("sha256")
    .update(await fs.readFile(filePath))
    .digest("hex");
  return {
    bytes: stats.size,
    width: video.width,
    height: video.height,
    duration: Number(probe.format?.duration),
    hasAudio: Boolean(audio),
    checksum: `sha256:${checksum}`,
  };
}

const defaults: Dependencies = {
  render: (input) => runRenderNow(input),
  capture: captureVideoSnapshot,
  media: resolveVideoStageMedia,
  load: getProductionJobStep,
  artifact: async (renderId) => {
    const render = await prisma.render.findUniqueOrThrow({
      where: { id: renderId },
      include: { script: { include: { takes: true } } },
    });
    if (!render.outputPath)
      throw new Error(`Render ${renderId} has no output path`);
    return {
      path: path.join(process.cwd(), "media", render.outputPath),
      expectsAudio: Boolean(render.voiceTakeId),
    };
  },
  verify: verifyProductionMp4,
  step: upsertProductionJobStep,
  output: addProductionJobOutput,
  synthesize: generateTakeFromVideoSnapshot,
};

const timingSchema = z.object({
  timeline: z.array(
    z.object({
      sceneId: z.string(),
      startFrame: z.number().int().nonnegative(),
      durationFrames: z.number().int().nonnegative(),
    }),
  ),
  totalFrames: z.number().int().positive(),
  takeUsable: z.boolean(),
});
const mediaSchema = z.object({
  snapshot: videoSnapshotSchema,
  assets: z.array(
    z.object({
      url: z.string(),
      resolvedUrl: z.string(),
      checksum: z.string().nullable(),
    }),
  ),
});
const audioSchema = z.object({
  take: videoSnapshotSchema.shape.take,
  mode: z.enum(["reuse", "synthesize", "silent"]),
  durationSeconds: z.number().nonnegative(),
  checksum: z.string().nullable(),
});
const artifactSchema = z.object({
  checksum: z.string(),
  path: z.string(),
  expectsAudio: z.boolean(),
});

export async function executeVideoProductionJob(
  job: ClaimedProductionJob,
  context: Context,
  dependencies: Dependencies = defaults,
): Promise<void> {
  return withProductionSignal(context.signal, async () => {
    const input = videoProductionJobInputSchema.parse(job.inputSnapshot);
    const takePath = (audioUrl: string) =>
      audioUrl.startsWith("/media/")
        ? path.join(process.cwd(), "media", audioUrl.slice(7))
        : null;
    const takeChecksum = async (audioUrl: string) => {
      const filePath = takePath(audioUrl);
      if (!filePath) return null;
      return createHash("sha256")
        .update(await fs.readFile(filePath))
        .digest("hex");
    };
    const active = async () => {
      if (context.signal.aborted || !(await context.heartbeat()))
        throw new Error("Production canceled");
    };
    async function stage<T>(
      key: ProductionStepKey,
      cacheInput: unknown,
      schema: z.ZodType<T>,
      run: () => Promise<unknown>,
      reusable: (value: T) => Promise<boolean> = async () => true,
    ): Promise<T> {
      await active();
      const cacheKey = videoStageHash({ version: 1, key, input: cacheInput });
      const saved = await dependencies.load(job.id, key);
      if (
        saved?.state === "succeeded" &&
        saved.cacheKey === cacheKey &&
        saved.detailJson
      ) {
        const parsed = schema.safeParse(
          (() => {
            try {
              return JSON.parse(saved.detailJson!);
            } catch {
              return null;
            }
          })(),
        );
        if (parsed.success && (await reusable(parsed.data))) return parsed.data;
      }
      await dependencies.step(job.id, key, {
        state: "running",
        progress: 0,
        cacheKey,
        leaseOwner: job.leaseOwner,
      });
      try {
        await active();
        const output = schema.parse(await run());
        await active();
        await dependencies.step(job.id, key, {
          state: "succeeded",
          progress: 1,
          cacheKey,
          detail: output,
          leaseOwner: job.leaseOwner,
        });
        return output;
      } catch (error) {
        await dependencies.step(job.id, key, {
          state: context.signal.aborted ? "canceled" : "failed",
          progress: 0,
          cacheKey,
          error: error instanceof Error ? error.message : String(error),
        });
        throw error;
      }
    }
    // Old queued inputs are frozen once on first execution; new submissions
    // already contain the immutable revision captured by the service.
    const snapshot = await stage(
      "validate",
      input,
      videoSnapshotSchema,
      async () =>
        input.snapshot ??
        dependencies.capture(input.scriptId, input.voiceTakeId),
    );
    const planned = await stage(
      "plan",
      snapshot,
      videoSnapshotSchema,
      async () => ({
        ...snapshot,
        script: {
          ...snapshot.script,
          scenes: [...snapshot.script.scenes].sort((a, b) => a.order - b.order),
        },
      }),
    );
    const media = await stage(
      "resolve_media",
      planned,
      mediaSchema,
      () => dependencies.media(planned, input.serverBaseUrl),
      async (saved) => {
        for (const asset of saved.assets)
          if (asset.checksum) {
            try {
              const data = await fs.readFile(
                path.join(process.cwd(), "media", asset.resolvedUrl.slice(7)),
              );
              if (
                createHash("sha256").update(data).digest("hex") !==
                asset.checksum
              )
                return false;
            } catch {
              return false;
            }
          }
        return true;
      },
    );
    const audio = await stage(
      "synthesize_audio",
      {
        take: media.snapshot.take,
        scenes: media.snapshot.script.scenes.map(resolveSpokenText),
        fps: media.snapshot.script.fps,
        quickProduceVoice: input.quickProduce?.voice,
      },
      audioSchema,
      async () => {
        const take = media.snapshot.take;
        const resolved = resolveReelTimeline(
          media.snapshot.script.scenes.map((scene) => ({
            id: scene.id,
            text: resolveSpokenText(scene),
          })),
          take,
          media.snapshot.script.fps,
        );
        if (!take && input.quickProduce?.voice.enabled) {
          const generated = await (
            dependencies.synthesize ?? defaults.synthesize!
          )({
            snapshot: media.snapshot,
            providerId: input.quickProduce.voice.providerId,
            voiceId: input.quickProduce.voice.voiceId,
            modelId: input.quickProduce.voice.modelId,
            label: "Quick Produce",
          });
          const frozen = videoTakeSnapshotSchema.parse(generated);
          return {
            take: frozen,
            mode: "synthesize" as const,
            durationSeconds: frozen.totalFrames / frozen.fps,
            checksum: await takeChecksum(frozen.audioUrl),
          };
        }
        if (!take || !resolved.takeUsable)
          return {
            take: null,
            mode: "silent" as const,
            durationSeconds: 0,
            checksum: null,
          };
        // A video request reuses an explicitly selected take. It never silently
        // initiates a paid synthesis operation or changes the selected voice.
        let durationSeconds = take.totalFrames / take.fps;
        if (take.audioUrl.startsWith("/media/")) {
          const wav = parseWav(
            await fs.readFile(
              path.join(process.cwd(), "media", take.audioUrl.slice(7)),
            ),
          );
          durationSeconds = wav.durationSeconds;
          if (durationSeconds <= 0)
            throw new Error("Selected voice take is empty");
        }
        return {
          take,
          mode: "reuse" as const,
          durationSeconds,
          checksum: await takeChecksum(take.audioUrl),
        };
      },
      async (saved) => {
        if (!saved.take || !saved.checksum) return saved.mode === "silent";
        try {
          return (await takeChecksum(saved.take.audioUrl)) === saved.checksum;
        } catch {
          return false;
        }
      },
    );
    const timing = await stage(
      "time_content",
      {
        audio,
        captions: media.snapshot.script.captionTracks,
        scenes: media.snapshot.script.scenes.map((scene) => ({
          id: scene.id,
          text: resolveSpokenText(scene),
        })),
        fps: media.snapshot.script.fps,
      },
      timingSchema,
      async () => {
        for (const track of media.snapshot.script.captionTracks ?? [])
          for (const cue of track.cues) {
            if (cue.endFrame <= cue.startFrame)
              throw new Error("Caption cue has invalid timing");
          }
        return resolveReelTimeline(
          media.snapshot.script.scenes.map((scene) => ({
            id: scene.id,
            text: resolveSpokenText(scene),
          })),
          audio.take,
          media.snapshot.script.fps,
        );
      },
    );
    const preparedSchema = z.object({
      snapshot: videoSnapshotSchema,
      timing: timingSchema,
      compositionHash: z.string(),
      composition: preparedVideoCompositionSchema,
    });
    const snapshotWithAudio = {
      ...media.snapshot,
      take: audio.take,
    };
    const prepared = await stage(
      "prepare_composition",
      {
        media: { ...media, snapshot: snapshotWithAudio },
        timing,
        orientation: input.orientation,
        base: input.serverBaseUrl,
      },
      preparedSchema,
      async () => {
        const composition = prepareVideoComposition(
          snapshotWithAudio,
          timing,
          input.orientation,
          input.serverBaseUrl,
        );
        return {
          snapshot: snapshotWithAudio,
          timing,
          compositionHash: videoStageHash(composition),
          composition,
        };
      },
    );
    const composition = prepared.composition;
    const artifact = await stage(
      "render_export",
      { prepared, quality: input.quality },
      artifactSchema,
      async () => {
        await dependencies.render({
          ...input,
          snapshot: prepared.snapshot,
          prepared: composition,
        });
        const artifact = await dependencies.artifact(input.renderId);
        const verified = await dependencies.verify(
          artifact.path,
          prepared.timing.takeUsable,
        );
        return {
          ...artifact,
          checksum: z.string().parse(verified.checksum),
          expectsAudio: prepared.timing.takeUsable,
        };
      },
      async (artifact) => {
        try {
          const verified = await dependencies.verify(
            artifact.path,
            artifact.expectsAudio,
          );
          return verified.checksum === artifact.checksum;
        } catch {
          return false;
        }
      },
    );
    const metadata = await stage(
      "verify_artifacts",
      { artifact, prepared },
      z.record(z.string(), z.unknown()),
      () => dependencies.verify(artifact.path, artifact.expectsAudio),
      async () => false,
    );
    await active();
    await dependencies.output(job.id, {
      kind: "video",
      leaseOwner: job.leaseOwner,
      format: "mp4",
      path: artifact.path,
      checksum:
        typeof metadata.checksum === "string" ? metadata.checksum : undefined,
      metadata: {
        ...metadata,
        stockMedia: stockMediaOutputMetadata(prepared.snapshot),
        revision: input.productionRevisionId
          ? {
              id: input.productionRevisionId,
              hash: input.revisionHash,
              projectId: prepared.snapshot.script.projectId,
              scriptId: prepared.snapshot.script.id,
            }
          : undefined,
      },
    });
  });
}
