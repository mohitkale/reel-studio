import { chapterPlanIssue, type ChapterPlan } from "@/production/chapters";

export const PRODUCTION_LIMITS = {
  videoSeconds: 180,
  chapterVideoSeconds: 300,
  audioSeconds: 180,
  podcastSeconds: 600,
  audiogramSeconds: 90,
} as const;

/** Higher duration is available only for a valid bounded chapter storyboard. */
export function videoDurationLimit(script: {
  fps: number;
  scenes: readonly { id: string }[];
  chapterPlan?: ChapterPlan;
}) {
  return script.chapterPlan &&
    [24, 30, 60].includes(script.fps) &&
    !chapterPlanIssue(
      script.chapterPlan,
      script.scenes.map((scene) => scene.id),
    )
    ? PRODUCTION_LIMITS.chapterVideoSeconds
    : PRODUCTION_LIMITS.videoSeconds;
}

export function assertVideoDuration(
  totalFrames: number,
  fps: number,
  maximumSeconds: number,
) {
  if (
    !Number.isInteger(totalFrames) ||
    totalFrames < 1 ||
    !Number.isFinite(fps) ||
    fps <= 0
  )
    throw new Error("Video duration needs valid frame timing.");
  if (
    !Number.isFinite(maximumSeconds) ||
    maximumSeconds <= 0 ||
    maximumSeconds > PRODUCTION_LIMITS.chapterVideoSeconds
  )
    throw new Error("Video duration policy is invalid.");
  if (totalFrames > Math.floor(fps * maximumSeconds))
    throw new Error(
      `Video is ${(totalFrames / fps).toFixed(1)} seconds including its cover. This job supports up to ${maximumSeconds} seconds; shorten it or create separate parts.`,
    );
}
