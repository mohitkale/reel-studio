/**
 * Shorts cutdowns from a long video (roadmap A5): pick self-contained runs of
 * scenes, add a hook and a closing line, and turn each into a vertical storyboard.
 * Plain code, no AI: the same video always gives the same cutdowns.
 */
import { cutAtBoundary, lintStoryboard, countWords } from "./lint";
import type { Scene, VideoStoryboard } from "./schema";

const WORDS_PER_SECOND = 2.5;
const MIN_SCENE_SECONDS = 2;
/** Scene types that open a thought and make a good first line. */
const HOOK_LIKE = new Set([
  "hook",
  "stat",
  "quote",
  "kinetic-text",
  "comparison",
  "before-after",
]);

export interface CutdownOptions {
  /** How many shorts to make. Default 3, at most 5. */
  count?: number;
  /** The most seconds one short may run. Default 45. */
  maxSeconds?: number;
  /** The shortest a short may be. Default 12. */
  minSeconds?: number;
  /** The closing line that points back to the full video. */
  closing?: string;
}

export interface Cutdown {
  storyboard: VideoStoryboard;
  /** Zero-based scene numbers in the source video, first to last (the added hook and close excluded). */
  from: number;
  to: number;
  /** Source scene for each short scene. Generated hooks and closings have no source. */
  sourceSceneIndices: Array<number | null>;
  seconds: number;
  /** Higher is better; the shorts are picked and ordered by it. */
  score: number;
}

const sceneSeconds = (scene: Scene) =>
  Math.max(
    MIN_SCENE_SECONDS,
    countWords(scene.narration) / WORDS_PER_SECOND,
    scene.durationHint ?? 0,
  );

function isChapterMarker(scene: Scene, title: string): boolean {
  const normalize = (text: string) =>
    text
      .toLowerCase()
      .replace(/[^\p{L}\p{N}]+/gu, " ")
      .trim();
  const spoken = normalize(scene.narration).replace(/^chapter \d+\b\s*/, "");
  return (
    !spoken ||
    spoken === normalize(title) ||
    spoken === normalize(scene.headline)
  );
}

/** Where a chapter or, without chapters, a run of scenes starts. */
function runStarts(board: VideoStoryboard): number[] {
  const marks = (board.chapters ?? []).map((c) => c.startScene);
  if (marks.length >= 2) return marks;
  // No chapters: a new run begins at every hook-like scene (and at the start).
  const starts = [0];
  for (let i = 1; i < board.scenes.length; i++)
    if (HOOK_LIKE.has(board.scenes[i]!.type)) starts.push(i);
  return starts;
}

function build(
  board: VideoStoryboard,
  scenes: Scene[],
  title: string,
  closing: string,
): VideoStoryboard {
  const first = scenes[0]!;
  const opening: Scene[] = HOOK_LIKE.has(first.type)
    ? []
    : [
        {
          type: "hook",
          headline: cutAtBoundary(title, 60),
          narration: `${cutAtBoundary(title, 120)}.`,
        } as Scene,
      ];
  const end: Scene = {
    type: "cta",
    headline: "Watch the full video",
    narration: closing,
  } as Scene;
  const { chapters: _c, publish: _p, ...rest } = board;
  void _c;
  void _p;
  return {
    ...rest,
    title: cutAtBoundary(title, 80),
    format: "9:16",
    scenes: [...opening, ...scenes, end],
  } as VideoStoryboard;
}

export function cutdowns(
  board: VideoStoryboard,
  options: CutdownOptions = {},
): Cutdown[] {
  const count = Math.min(5, Math.max(1, options.count ?? 3));
  const maxSeconds = options.maxSeconds ?? 45;
  const minSeconds = options.minSeconds ?? 12;
  const closing =
    options.closing ??
    "There is a lot more in the full video. Watch it for the whole story.";
  const starts = runStarts(board);
  const chapterTitles = new Map(
    (board.chapters ?? []).map((c) => [c.startScene, c.title]),
  );
  const candidates: Cutdown[] = [];
  for (const [index, start] of starts.entries()) {
    const end = (starts[index + 1] ?? board.scenes.length) - 1;
    // Keep narrated chapter openings: they give the short its context.
    const chapterTitle = chapterTitles.get(start);
    const from =
      start > 0 &&
      chapterTitle &&
      isChapterMarker(board.scenes[start]!, chapterTitle)
        ? start + 1
        : start;
    const run: Scene[] = [];
    // The added hook takes about three seconds when the run does not open on one.
    let seconds = HOOK_LIKE.has(board.scenes[from]?.type ?? "") ? 0 : 3;
    let last = from - 1;
    for (let i = from; i <= end; i++) {
      const scene = board.scenes[i]!;
      const next = sceneSeconds(scene);
      // Leave room for the closing line (about four seconds).
      if (run.length >= 2 && seconds + next + 4 > maxSeconds) break;
      run.push(scene);
      seconds += next;
      last = i;
    }
    if (run.length < 2 || seconds + 4 < minSeconds) continue;
    if (seconds + 4 > maxSeconds) continue;
    const title =
      chapterTitle ?? cutAtBoundary(run[0]!.headline || board.title, 60);
    const storyboard = build(board, run, title, closing);
    const lint = lintStoryboard(storyboard);
    if (
      lint.errors.length > 0 ||
      !lint.storyboard ||
      lint.storyboard.kind !== "video"
    )
      continue;
    // Fewer warnings is better; a hook-like opening and a good length help.
    const hasHook = HOOK_LIKE.has(run[0]!.type);
    const hookBonus = hasHook ? 2 : 0;
    const lengthBonus = seconds >= 20 && seconds <= maxSeconds - 4 ? 1 : 0;
    candidates.push({
      storyboard: lint.storyboard,
      from,
      to: last,
      sourceSceneIndices: [
        ...(hasHook ? [] : [null]),
        ...run.map((_, index) => from + index),
        null,
      ],
      seconds: Math.round(seconds + 4),
      score: hookBonus + lengthBonus - lint.warnings.length,
    });
  }
  // Best first; ties keep the earlier run. Runs never overlap by construction.
  return candidates
    .map((c, order) => ({ c, order }))
    .sort((a, b) => b.c.score - a.c.score || a.order - b.order)
    .slice(0, count)
    .map(({ c }) => c);
}
