import { DEFAULT_GAP_SECONDS } from "@/lib/audio-timing";

/**
 * Landing scene starts on the music's beat (roadmap A3). Narration is never
 * stretched or squeezed: only the silence between two scenes changes, and only
 * within a window around the usual gap, so the pacing barely moves. A scene
 * whose next beat is too far away keeps the usual gap.
 */
export interface BeatGrid {
  bpm: number;
  /** Seconds from the start of the music to its first beat. */
  offsetSeconds: number;
}

export const MIN_GAP_SECONDS = 0.3;
export const MAX_GAP_SECONDS = 0.8;

/**
 * The spacing of the landing points: a beat, or for slow music its half,
 * quarter and so on, until it is no wider than the gap window. Then every scene
 * has a landing point to choose from.
 */
export function gridStepSeconds(grid: BeatGrid): number {
  let step = 60 / grid.bpm;
  while (step > MAX_GAP_SECONDS - MIN_GAP_SECONDS + 1e-9) step /= 2;
  return step;
}

/** The beat time (seconds from the start of the music) nearest to `seconds` within [from, to], if any. */
function beatNear(
  grid: BeatGrid,
  target: number,
  from: number,
  to: number,
): number | undefined {
  const interval = gridStepSeconds(grid);
  let best: number | undefined;
  const first = Math.ceil((from - grid.offsetSeconds) / interval - 1e-9);
  for (let k = first; ; k++) {
    const at = grid.offsetSeconds + k * interval;
    if (at > to + 1e-9) break;
    if (best === undefined || Math.abs(at - target) < Math.abs(best - target))
      best = at;
  }
  return best;
}

/**
 * The silence to put after each scene (length `durations.length - 1`) so that
 * each following scene starts on a beat. `coverSeconds` is the time before the
 * narration begins (a cover frame): the music runs from the first frame.
 */
export function beatAlignedGaps(args: {
  /** Seconds of narration in each scene, in order. */
  durations: readonly number[];
  grid: BeatGrid;
  coverSeconds?: number;
  gapSeconds?: number;
}): number[] {
  const usual = args.gapSeconds ?? DEFAULT_GAP_SECONDS;
  const cover = args.coverSeconds ?? 0;
  const gaps: number[] = [];
  let start = 0;
  for (let i = 0; i < args.durations.length - 1; i++) {
    const end = start + args.durations[i]!;
    const beat = beatNear(
      args.grid,
      cover + end + usual,
      cover + end + MIN_GAP_SECONDS,
      cover + end + MAX_GAP_SECONDS,
    );
    const gap =
      beat === undefined
        ? usual
        : Math.round((beat - cover - end) * 1000) / 1000;
    gaps.push(gap);
    start = end + gap;
  }
  return gaps;
}

/** How far each scene start is from the nearest beat, in seconds, for checking a result. */
export function offBeatSeconds(
  starts: readonly number[],
  grid: BeatGrid,
  coverSeconds = 0,
): number[] {
  const interval = gridStepSeconds(grid);
  return starts.map((start) => {
    const at = coverSeconds + start - grid.offsetSeconds;
    const k = Math.round(at / interval);
    return Math.abs(at - k * interval);
  });
}
