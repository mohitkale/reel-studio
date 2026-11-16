/**
 * Progress wording and time estimates for a production job (roadmap V9b).
 *
 * The estimate starts from the render benchmark (`docs/quality/render-benchmark.json`)
 * and switches to the pace this job has actually shown once it is far enough
 * along to trust. Only the draft rate is measured; for other qualities the
 * estimate waits for real progress instead of guessing.
 */

/** Seconds of render per second of video at draft quality (benchmark, 1.31 to 1.53). */
export const DRAFT_RENDER_RATIO = 1.4;
/** Share of progress after which the observed pace replaces the benchmark. */
const TRUST_AFTER = 0.12;

export type RenderQuality = "draft" | "standard" | "high";

export interface RenderEstimateInput {
  quality?: RenderQuality;
  videoSeconds: number;
  /** Overall job progress, 0 to 1. */
  progress: number;
  /** Seconds since the job started. */
  elapsedSeconds: number;
}

/** Seconds left, or null when there is nothing trustworthy to say yet. */
export function estimateRemainingSeconds(
  input: RenderEstimateInput,
): number | null {
  const { progress, elapsedSeconds, videoSeconds, quality } = input;
  if (progress >= 1) return 0;
  if (progress >= TRUST_AFTER && elapsedSeconds > 0) {
    return Math.max(0, (elapsedSeconds * (1 - progress)) / progress);
  }
  if (quality === "draft" && videoSeconds > 0) {
    const total = videoSeconds * DRAFT_RENDER_RATIO;
    return Math.max(0, total - elapsedSeconds);
  }
  return null;
}

/** "about 40 s left", "about 2 min left"; "almost done" under ten seconds. */
export function formatRemaining(seconds: number | null): string | null {
  if (seconds === null) return null;
  if (seconds < 10) return "almost done";
  if (seconds < 90) return `about ${Math.round(seconds / 5) * 5} s left`;
  return `about ${Math.round(seconds / 60)} min left`;
}

/** Which scene a render fraction falls in, by scene length (1-based). */
export function sceneAtFraction(
  durations: number[],
  fraction: number,
): { scene: number; total: number } | null {
  const total = durations.reduce((sum, d) => sum + d, 0);
  if (!durations.length || total <= 0) return null;
  const at = Math.min(Math.max(fraction, 0), 0.9999) * total;
  let acc = 0;
  for (const [i, d] of durations.entries()) {
    acc += d;
    if (at < acc) return { scene: i + 1, total: durations.length };
  }
  return { scene: durations.length, total: durations.length };
}

const STAGE_LABEL: Record<string, string> = {
  validate: "Checking the storyboard",
  plan: "Planning scenes",
  resolve_media: "Finding media",
  synthesize_audio: "Recording the narration",
  time_content: "Timing captions and scenes",
  prepare_composition: "Preparing the video",
  render_export: "Rendering",
  verify_artifacts: "Checking the file",
};

export interface JobProgressInput {
  steps: Array<{ key: string; state: string; progress: number }>;
  progress: number;
  /** Scene lengths in seconds, in order (empty when unknown). */
  sceneSeconds: number[];
  quality?: RenderQuality;
  elapsedSeconds: number;
}

/** One line for the status card: stage, scene while rendering, time left. */
export function describeJobProgress(input: JobProgressInput): string {
  const running = input.steps.find((s) => s.state === "running");
  const key = running?.key ?? "validate";
  const parts = [STAGE_LABEL[key] ?? "Working"];
  if (key === "render_export") {
    const at = sceneAtFraction(input.sceneSeconds, running?.progress ?? 0);
    if (at) parts[0] = `Rendering scene ${at.scene} of ${at.total}`;
  }
  const left = formatRemaining(
    estimateRemainingSeconds({
      quality: input.quality,
      videoSeconds: input.sceneSeconds.reduce((a, b) => a + b, 0),
      progress: input.progress,
      elapsedSeconds: input.elapsedSeconds,
    }),
  );
  if (left) parts.push(left);
  return parts.join(" · ");
}
