import type { ReelBeat } from "@/compositions/types";
import { estimateTimeline } from "./preview-timeline";

interface SceneText {
  id: string;
  text: string;
}

interface TimedBeat {
  sceneId: string;
  startFrame: number;
  durationFrames: number;
  text: string;
}

interface TakeTiming {
  timeline: TimedBeat[];
  totalFrames: number;
}

export interface ResolvedTimeline {
  timeline: ReelBeat[];
  totalFrames: number;
  /** True when the take's audio still matches the script and is safe to play. */
  takeUsable: boolean;
}

const norm = (s: string) => s.trim().replace(/\s+/g, " ").toLowerCase();

/**
 * Reconcile a voice take with the current scenes.
 *
 * A take's audio depends only on the spoken *text*, so it stays valid across
 * background / template / effect / emphasis edits — and even an AI rewrite that
 * reproduces the same text with new scene ids — because we match beats to scenes
 * by text (in order) and remap them onto the current scene ids. The take only
 * becomes stale when the spoken text itself changes, or scenes are added in the
 * middle / removed / reordered; then we fall back to estimated, silent timing so
 * audio is never played over the wrong visuals.
 *
 * Shared by the editor preview and the renderer so both behave identically.
 */
export function resolveReelTimeline(
  scenes: SceneText[],
  take: TakeTiming | null,
  fps: number,
): ResolvedTimeline {
  const estimated = estimateTimeline(
    scenes.map((s) => ({ id: s.id, text: s.text })),
    fps,
  );
  const silent: ResolvedTimeline = {
    timeline: estimated.timeline,
    totalFrames: estimated.totalFrames,
    takeUsable: false,
  };

  const beats = take?.timeline ?? [];
  if (!take || beats.length === 0) return silent;

  // Leading scenes whose spoken text still matches the take, in order.
  let matched = 0;
  while (
    matched < beats.length &&
    matched < scenes.length &&
    norm(beats[matched].text) === norm(scenes[matched].text)
  ) {
    matched++;
  }

  // Usable only if every recorded beat still maps to a leading scene. If not, a
  // covered scene's text changed or it was removed, which would desync the audio.
  if (matched === 0 || matched !== beats.length) return silent;

  // Remap recorded beats onto the current scene ids (a no-op when ids are
  // unchanged; repairs a rewrite that kept the text but produced new ids).
  const recorded: ReelBeat[] = beats.map((b, i) => ({
    sceneId: scenes[i].id,
    startFrame: b.startFrame,
    durationFrames: b.durationFrames,
  }));

  if (matched === scenes.length) {
    return { timeline: recorded, totalFrames: take.totalFrames, takeUsable: true };
  }

  // Extra scenes appended after the take: estimate timing for them, after the audio.
  const rest = estimateTimeline(
    scenes.slice(matched).map((s) => ({ id: s.id, text: s.text })),
    fps,
  );
  return {
    timeline: [
      ...recorded,
      ...rest.timeline.map((b) => ({
        ...b,
        startFrame: b.startFrame + take.totalFrames,
      })),
    ],
    totalFrames: take.totalFrames + rest.totalFrames,
    takeUsable: true,
  };
}
