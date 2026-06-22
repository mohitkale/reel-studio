import type { ReelBeat } from "@/compositions/types";

/**
 * Client-safe timeline estimate for previewing templates before a voice take
 * exists. Mirrors the server's spoken-duration heuristic (~150 wpm, 0.3s gaps)
 * but produces no audio. Once a take is generated, its exact timeline is used.
 */
export function estimateTimeline(
  scenes: { id: string; text: string }[],
  fps: number,
  gapSeconds = 0.3,
): { timeline: ReelBeat[]; totalFrames: number } {
  let cursorSeconds = 0;
  const timeline: ReelBeat[] = [];

  scenes.forEach((scene, i) => {
    const words = scene.text.trim().split(/\s+/).filter(Boolean).length;
    const seconds = Math.max(1.2, (words / 150) * 60);
    timeline.push({
      sceneId: scene.id,
      startFrame: Math.round(cursorSeconds * fps),
      durationFrames: Math.max(1, Math.round(seconds * fps)),
    });
    cursorSeconds += seconds;
    if (i < scenes.length - 1) cursorSeconds += gapSeconds;
  });

  return {
    timeline,
    totalFrames: Math.max(1, Math.round(cursorSeconds * fps)),
  };
}
