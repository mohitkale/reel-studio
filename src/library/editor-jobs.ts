import { createProgressWriter } from "@/library/progress-writer";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { prisma } from "@/library/db";
import type { VoiceJob } from "@/lib/voice-queue";
import {
  editorVoiceInputSchema,
  type ClaimedProductionJob,
} from "@/production/jobs";
import type { ProductionJobExecution } from "@/library/production-worker";
import {
  enqueueProductionJob,
  getProductionJob,
  upsertProductionJobStep,
} from "@/library/repositories/production-jobs";
import { generateTake } from "@/library/take-service";
import {
  generateSceneClip,
  generateAllSceneClips,
} from "@/library/scene-voice-service";
import { generatePodcastTake } from "@/library/podcast-take-service";
import { getPodcast, getPodcastTake } from "@/library/repositories/podcasts";
import { getSceneClip } from "@/library/repositories/scene-clips";
import { toTakeDTO } from "@/library/repositories/map";

const progressSchema = z.object({
  status: z.enum(["queued", "synthesizing", "stitching", "done", "error"]),
  scene: z.number().int().nonnegative(),
  sceneCount: z.number().int().nonnegative(),
  workingOn: z.number().int().optional(),
  cached: z.number().int().optional(),
  generated: z.number().int().optional(),
  takeId: z.string().optional(),
  podcastTakeId: z.string().optional(),
  clipId: z.string().optional(),
  clipIds: z.array(z.string()).optional(),
});

export function podcastVoiceSignature(
  podcast: NonNullable<Awaited<ReturnType<typeof getPodcast>>>,
) {
  return JSON.stringify(
    podcast.characters
      .map((c) => [c.id, c.providerId, c.voiceId, c.modelId])
      .sort(),
  );
}

export async function submitEditorVoice(
  input: z.input<typeof editorVoiceInputSchema>,
) {
  const data = editorVoiceInputSchema.parse(input);
  const job = await enqueueProductionJob({
    kind: "editor_voice",
    idempotencyKey: `editor-voice:${randomUUID()}`,
    inputSnapshot: data,
  });
  return job.id;
}

/** Read progress in any web/worker process; completion DTOs come from their repositories. */
export async function getEditorVoiceJob(
  id: string,
  resourceId: string,
  podcast = false,
): Promise<VoiceJob | undefined> {
  const row = await getProductionJob(id);
  if (!row || row.kind !== "editor_voice") return;
  const input = editorVoiceInputSchema.parse(JSON.parse(row.inputSnapshot));
  if (
    (input.operation === "podcast") !== podcast ||
    (input.scriptId ?? input.resourceId) !== resourceId
  )
    return;
  const detail = row.steps.find(
    (s) => s.key === "synthesize_audio",
  )?.detailJson;
  const parsed = progressSchema.safeParse(detail ? JSON.parse(detail) : {});
  const progress = parsed.success
    ? parsed.data
    : { status: "queued" as const, scene: 0, sceneCount: 0 };
  const status = ["failed", "canceled"].includes(row.state)
    ? "error"
    : row.state === "succeeded"
      ? "done"
      : row.state === "queued"
        ? "queued"
        : progress.status === "done"
          ? "stitching"
          : progress.status;
  const result: VoiceJob = {
    id,
    ...progress,
    status,
    error:
      row.error ??
      (row.state === "canceled" ? "Voice generation canceled" : undefined),
  };
  if (status === "done" && parsed.success) {
    const p = parsed.data;
    if (p.takeId) {
      const take = await prisma.voiceTake.findUnique({
        where: { id: p.takeId },
      });
      if (take) result.take = toTakeDTO(take);
    }
    if (p.podcastTakeId)
      result.podcastTake = (await getPodcastTake(p.podcastTakeId)) ?? undefined;
    if (p.clipId) result.clip = (await getSceneClip(p.clipId)) ?? undefined;
    if (p.clipIds)
      result.clips = (await Promise.all(p.clipIds.map(getSceneClip))).filter(
        (c) => c !== null,
      );
  }
  if (
    status === "done" &&
    !result.take &&
    !result.podcastTake &&
    !result.clip &&
    !result.clips
  ) {
    result.status = "error";
    result.error =
      "Generated output is no longer available; inspect saved takes before retrying";
  }
  return result;
}

export async function executeEditorVoiceJob(
  job: ClaimedProductionJob,
  context: ProductionJobExecution,
) {
  const input = editorVoiceInputSchema.parse(job.inputSnapshot);
  let progress: z.infer<typeof progressSchema> = {
    status: "synthesizing",
    scene: 0,
    sceneCount: 0,
  };
  const writer = createProgressWriter<z.infer<typeof progressSchema>>(
    (snapshot) =>
      upsertProductionJobStep(job.id, "synthesize_audio", {
        state: "running",
        progress: snapshot.sceneCount
          ? snapshot.scene / snapshot.sceneCount
          : 0,
        detail: snapshot,
        leaseOwner: job.leaseOwner,
      }),
  );
  let previousStatus: string | undefined;
  const persist = () => {
    context.signal.throwIfAborted();
    writer.push({ ...progress }, progress.status !== previousStatus);
    previousStatus = progress.status;
  };
  const onProgress = (p: {
    phase: "synthesizing" | "stitching";
    scene: number;
    sceneCount: number;
    workingOn?: number;
    cached?: number;
    generated?: number;
  }) => {
    progress = { ...progress, ...p, status: p.phase };
    persist();
  };
  persist();
  try {
    context.signal.throwIfAborted();
    if (input.operation === "podcast") {
      const podcast = await getPodcast(input.resourceId);
      if (
        !podcast ||
        podcastVoiceSignature(podcast) !== input.podcastVoiceSignature
      )
        throw new Error(
          "Podcast voices changed after submission; submit a new generation request",
        );
      const take = await generatePodcastTake({
        podcastId: input.resourceId,
        regenerateTurnIds: input.regenerateTurnIds,
        onProgress,
      });
      progress = {
        ...progress,
        scene: take.timeline.length,
        sceneCount: take.timeline.length,
        podcastTakeId: take.id,
      };
    } else if (input.operation === "scene") {
      const { clip, take } = await generateSceneClip({
        ...input,
        sceneId: input.resourceId,
      });
      progress = {
        ...progress,
        scene: 1,
        sceneCount: 1,
        clipId: clip.id,
        takeId: take?.id,
      };
    } else if (input.operation === "scene_all") {
      const { clips, take } = await generateAllSceneClips({
        ...input,
        scriptId: input.resourceId,
        onProgress,
      });
      progress = {
        ...progress,
        scene: clips.length,
        sceneCount: clips.length,
        clipIds: clips.map((c) => c.id),
        takeId: take?.id,
      };
    } else {
      const take = await generateTake({
        ...input,
        scriptId: input.resourceId,
        onProgress,
      });
      progress = {
        ...progress,
        scene: take.timeline.length,
        sceneCount: take.timeline.length,
        takeId: take.id,
      };
    }
    await writer.flush();
    await writer.stop();
    context.signal.throwIfAborted();
    await upsertProductionJobStep(job.id, "synthesize_audio", {
      state: "succeeded",
      progress: 1,
      detail: { ...progress, status: "done" },
      leaseOwner: job.leaseOwner,
    });
  } finally {
    await writer.stop();
  }
}
