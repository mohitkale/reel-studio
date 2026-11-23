import { execFile } from "node:child_process";
import { realpath } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import { z } from "zod";

import { ProviderError } from "@/providers/voice/types";
import { videoProductionJobInputSchema } from "@/production/jobs";
import {
  preparedVideoCompositionSchema,
  videoSnapshotSchema,
  type VideoSnapshot,
} from "@/production/video-snapshot";
import { planVisualReview } from "@/production/visual-review";
import { coverFrames } from "@/video/types";
import { getProductionJob } from "./repositories/production-jobs";

const checkpointSchema = z.object({
  snapshot: videoSnapshotSchema,
  composition: preparedVideoCompositionSchema,
});

export async function getCompletedVideoReview(id: string) {
  const job = await getProductionJob(id);
  if (job?.kind !== "video" || job.state !== "succeeded")
    throw new ProviderError("A finished video is required for review", 404);
  const detail = job.steps.find(
    (step) => step.key === "prepare_composition",
  )?.detailJson;
  const video = job.outputs.find(
    (output) => output.kind === "video" && output.format === "mp4",
  );
  const prepared = checkpointSchema.safeParse(detail && JSON.parse(detail));
  if (!prepared.success || !video)
    throw new ProviderError("This export has no saved review evidence", 404);
  return {
    ...prepared.data,
    input: videoProductionJobInputSchema.parse(JSON.parse(job.inputSnapshot)),
    video,
  };
}

export function reviseCompletedHeadline(
  snapshot: VideoSnapshot,
  index: number,
  expected: string,
  headline: string,
): VideoSnapshot | null {
  const scene = snapshot.script.scenes[index - 1];
  if (
    snapshot.factory ||
    !scene ||
    scene.locks?.scene ||
    scene.locks?.copy ||
    scene.text !== expected ||
    scene.text === headline
  )
    return null;
  return {
    ...snapshot,
    filmPlan: undefined,
    script: {
      ...snapshot.script,
      scenes: snapshot.script.scenes.map((entry) =>
        entry.id === scene.id
          ? {
              ...entry,
              text: headline,
              spokenText: entry.spokenText ?? scene.text,
            }
          : entry,
      ),
    },
  };
}

export async function completedVideoFrame(
  review: Awaited<ReturnType<typeof getCompletedVideoReview>>,
  sceneNumber: number,
  signal: AbortSignal,
) {
  const { props, totalFrames } = review.composition;
  const scene = props.timeline[sceneNumber - 1];
  if (!scene) throw new ProviderError("Scene number is out of range", 400);
  const [point] = planVisualReview(
    props.timeline,
    [scene.sceneId],
    1,
    coverFrames(props.fps, Boolean(props.coverUrl)),
  );
  const root = await realpath(path.join(process.cwd(), "media"));
  const file = await realpath(path.resolve(root, review.video.path));
  if (!file.startsWith(root + path.sep))
    throw new ProviderError("The video is outside the media store", 404);
  const time = Math.min(point.frame, totalFrames - 1) / props.fps;
  const { stdout } = await promisify(execFile)(
    "ffmpeg",
    [
      "-v",
      "error",
      "-ss",
      String(time),
      "-i",
      file,
      "-frames:v",
      "1",
      "-c:v",
      "png",
      "-f",
      "image2pipe",
      "-",
    ],
    {
      encoding: "buffer",
      maxBuffer: 10 * 1024 * 1024,
      timeout: 30_000,
      signal,
    },
  );
  if (!stdout.length)
    throw new ProviderError("The selected frame could not be decoded", 404);
  return stdout;
}
