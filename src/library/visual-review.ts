import { promises as fs } from "node:fs";
import path from "node:path";
import { tmpdir } from "node:os";
import { spawn } from "node:child_process";
import { renderStill, selectComposition } from "@remotion/renderer";
import { captureVideoSnapshot } from "@/library/video-snapshot";
import {
  getRemotionServeUrl,
  prepareVideoComposition,
} from "@/library/render-service";
import {
  resolveVideoStageMedia,
  videoStageHash,
} from "@/library/video-stage-media";
import { writeHyperframesReviewProject } from "@/library/hyperframes-render";
import { getAssetStore } from "@/library/storage";
import { resolveReelTimeline } from "@/lib/reel-timeline";
import { resolveSpokenText } from "@/lib/spoken-text";
import { coverFrames, type ReelProps } from "@/compositions/types";
import { ProviderError } from "@/providers/voice/types";
import {
  planVisualReview,
  planTransitionReview,
  visualReviewRequestSchema,
  type VisualReviewRequest,
  type VisualReviewResult,
} from "@/production/visual-review";
import type { VideoEngineId } from "@/engines/types";
import { videoDurationLimit } from "@/production/limits";
import {
  cancelChild,
  cancelableRemotion,
} from "@/library/production-cancellation";

function runSnapshot(args: string[], signal?: AbortSignal): Promise<string> {
  const captureSignal = AbortSignal.any([
    AbortSignal.timeout(120_000),
    ...(signal ? [signal] : []),
  ]);
  captureSignal.throwIfAborted();
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, args, {
      detached: process.platform !== "win32",
      stdio: ["ignore", "pipe", "pipe"],
      env: { ...process.env, HYPERFRAMES_NO_TELEMETRY: "1" },
    });
    cancelChild(child, captureSignal);
    let output = "";
    let overflow = false;
    const append = (data: Buffer) => {
      if (output.length + data.length > 2 * 1024 * 1024) overflow = true;
      else output += data.toString();
    };
    child.stdout.on("data", append);
    child.stderr.on("data", append);
    child.once("error", reject);
    child.once("close", (code) => {
      if (captureSignal.aborted)
        reject(
          new Error("Visual review was canceled or timed out. Try again."),
        );
      else if (code !== 0 || overflow)
        reject(
          new Error(
            "Visual review capture failed. Check the media and try again.",
          ),
        );
      else resolve(output);
    });
  });
}
// Review Chrome sessions are serialized; only a bounded number of requests wait.
let tail: Promise<void> = Promise.resolve();
let pending = 0;
async function serialized<T>(action: () => Promise<T>): Promise<T> {
  if (pending >= 4)
    throw new ProviderError("Visual review is busy. Try again shortly.", 429);
  pending++;
  const previous = tail;
  let release!: () => void;
  tail = new Promise<void>((resolve) => {
    release = resolve;
  });
  try {
    await previous;
    return await action();
  } finally {
    pending--;
    release();
  }
}

/** Engine-native stills; HyperFrames snapshot includes FFmpeg footage injection. */
export async function renderVisualReviewFrames(
  engine: VideoEngineId,
  props: ReelProps & { fps: number },
  totalFrames: number,
  frames: readonly number[],
  outputDir: string,
  serverBaseUrl: string,
  signal?: AbortSignal,
): Promise<string[]> {
  await fs.mkdir(outputDir, { recursive: true });
  if (engine === "remotion") {
    const serveUrl = await getRemotionServeUrl();
    const composition = await selectComposition({
      serveUrl,
      id: "Reel",
      inputProps: props,
    });
    const paths: string[] = [];
    for (const frame of frames) {
      const outputLocation = path.join(outputDir, `frame-${frame}.png`);
      await cancelableRemotion(
        (cancelSignal) =>
          renderStill({
            cancelSignal,
            serveUrl,
            composition: { ...composition, durationInFrames: totalFrames },
            inputProps: props,
            frame,
            imageFormat: "png",
            output: outputLocation,
            logLevel: "error",
            timeoutInMilliseconds: 60_000,
          }),
        signal,
      );
      paths.push(outputLocation);
    }
    return paths;
  }
  const projectDir = await fs.mkdtemp(path.join(tmpdir(), "reel-review-hf-"));
  try {
    await writeHyperframesReviewProject(projectDir, props, serverBaseUrl);
    const output = await runSnapshot(
      [
        path.join(
          process.cwd(),
          "node_modules/hyperframes/bin/hyperframes.mjs",
        ),
        "snapshot",
        projectDir,
        "--at",
        frames.map((frame) => frame / props.fps).join(","),
        "--no-end",
        "--output",
        outputDir,
        "--describe",
        "false",
        "--no-browser-gpu",
      ],
      signal,
    );
    // Refuse misleading stills when the CLI reports a correctness warning.
    if (
      /will appear black|frame injection failed|snapshots may be inaccurate|Fonts FAILED/i.test(
        output,
      )
    )
      throw new Error(
        "A review asset could not be captured. Check the media and try again.",
      );
    const images = (await fs.readdir(outputDir))
      .filter((name) => /^frame-\d+-at-.*\.png$/.test(name))
      .sort();
    if (images.length !== frames.length)
      throw new Error("Review capture did not produce every requested frame.");
    return images.map((name) => path.join(outputDir, name));
  } finally {
    await fs.rm(projectDir, { recursive: true, force: true });
  }
}

export async function createVisualReview(
  scriptId: string,
  request: VisualReviewRequest,
  serverBaseUrl: string,
  signal?: AbortSignal,
): Promise<VisualReviewResult> {
  const input = visualReviewRequestSchema.parse(request);
  return serialized(async () => {
    signal?.throwIfAborted();
    const captured = await captureVideoSnapshot(scriptId, input.voiceTakeId);
    captured.script.scenes.sort((a, b) => a.order - b.order);
    const timing = resolveReelTimeline(
      captured.script.scenes.map((scene) => ({
        id: scene.id,
        text: resolveSpokenText(scene),
      })),
      captured.take,
      captured.script.fps,
    );
    const cover = coverFrames(
      captured.script.fps,
      Boolean(captured.script.coverUrl),
    );
    const durationLimit = videoDurationLimit(captured.script);
    if ((timing.totalFrames + cover) / captured.script.fps > durationLimit)
      throw new ProviderError(
        `Visual review supports up to ${durationLimit} seconds for this storyboard.`,
        400,
      );
    let points;
    try {
      points =
        input.mode === "transition"
          ? planTransitionReview(
              timing.timeline,
              input.sceneIds[0],
              captured.script.fps,
              cover,
            )
          : planVisualReview(
              timing.timeline,
              input.sceneIds,
              input.samples,
              cover,
            );
    } catch (error) {
      throw new ProviderError(
        error instanceof Error ? error.message : "Invalid review scenes",
        400,
      );
    }
    // Freeze only visual media. Review never needs to load or play the audio bed.
    const silent = structuredClone(captured);
    silent.take = null;
    silent.script.musicUrl = null;
    silent.script.sfxEnabled = false;
    const { snapshot } = await resolveVideoStageMedia(silent, serverBaseUrl);
    const prepared = prepareVideoComposition(
      snapshot,
      timing,
      undefined,
      serverBaseUrl,
    );
    const props = {
      ...prepared.props,
      width: captured.script.width,
      height: captured.script.height,
      fps: captured.script.fps,
      audioUrl: undefined,
      musicUrl: undefined,
      sfxCues: [],
    };
    const revision = videoStageHash({
      contract: 1,
      engine: captured.script.videoEngine,
      props,
      totalFrames: prepared.totalFrames,
    });
    const store = getAssetStore();
    const key = (frame: number) => `review-stills/${revision}/${frame}.png`;
    const missing = [];
    for (const point of points)
      if (!(await store.exists(key(point.frame)))) missing.push(point);
    if (missing.length) {
      const outputDir = await fs.mkdtemp(
        path.join(tmpdir(), "reel-review-frames-"),
      );
      try {
        const paths = await renderVisualReviewFrames(
          captured.script.videoEngine,
          props,
          prepared.totalFrames,
          missing.map((point) => point.frame),
          outputDir,
          serverBaseUrl,
          signal,
        );
        for (const [index, file] of paths.entries())
          await store.put(key(missing[index].frame), await fs.readFile(file));
      } finally {
        await fs.rm(outputDir, { recursive: true, force: true });
      }
    }
    return {
      revision,
      videoEngine: captured.script.videoEngine,
      width: props.width,
      height: props.height,
      fps: props.fps,
      takeUsable: timing.takeUsable,
      stills: points.map((point) => ({
        ...point,
        url: store.url(key(point.frame)),
      })),
    };
  });
}
