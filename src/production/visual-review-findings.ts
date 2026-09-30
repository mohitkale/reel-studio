import type { ReelBeat, ReelScene } from "@/compositions/types";
import {
  reviewMotionRepetition,
  reviewMotionTreatments,
} from "@/production/motion-review";

export interface VisualReviewFinding {
  sceneId: string;
  sceneNumber: number;
  frame: number;
  kind:
    | "fallback"
    | "repetition"
    | "reading-time"
    | "text-clipping"
    | "safe-area"
    | "contrast";
  message: string;
}

/** Advisory checks on saved inputs/timing, never a pixel or taste score.
 * Reading allowance is a deliberately simple copy-length heuristic: one second
 * to orient, then 20 non-space Unicode characters/second. It is not measured
 * visibility, a language-specific reading rate or an animation settle time.
 */
export function reviewVisualInputs(
  scenes: readonly ReelScene[],
  timeline: readonly ReelBeat[],
  selectedSceneIds: readonly string[],
  fps: number,
  cover = 0,
): VisualReviewFinding[] {
  if (!Number.isFinite(fps) || fps <= 0) return [];
  const selected = new Set(selectedSceneIds);
  const beats = new Map(timeline.map((beat, index) => [beat.sceneId, index]));
  const positions = new Map(scenes.map((scene, index) => [scene.id, index]));
  const finding = (
    sceneId: string,
    kind: VisualReviewFinding["kind"],
    message: string,
  ): VisualReviewFinding[] => {
    const index = beats.get(sceneId);
    const position = positions.get(sceneId);
    return selected.has(sceneId) &&
      index !== undefined &&
      position !== undefined
      ? [
          {
            sceneId,
            sceneNumber: position + 1,
            frame: cover + timeline[index].startFrame,
            kind,
            message,
          },
        ]
      : [];
  };
  const inputs = scenes.map((scene) => ({
    ...scene,
    hasVisualContent: Boolean(scene.visual),
  }));
  const findings = [
    ...reviewMotionTreatments(inputs).flatMap((issue) =>
      finding(
        issue.sceneId,
        "fallback",
        `${issue.reason} The preset look is used until this fits.`,
      ),
    ),
    ...reviewMotionRepetition(inputs).flatMap((run) =>
      finding(
        scenes
          .slice(run.firstSceneNumber - 1, run.lastSceneNumber)
          .find((scene) => selected.has(scene.id))?.id ?? run.sceneId,
        "repetition",
        `Scenes ${run.firstSceneNumber}–${run.lastSceneNumber} share one treatment. Review a scene for contrast, or keep the continuity.`,
      ),
    ),
  ];
  for (const scene of scenes) {
    if (!selected.has(scene.id) || scene.hideText) continue;
    const index = beats.get(scene.id);
    if (index === undefined) continue;
    const beat = timeline[index];
    // A beat holds until the next start in both engines, including silent gaps.
    const end =
      timeline[index + 1]?.startFrame ?? beat.startFrame + beat.durationFrames;
    const seconds = (end - beat.startFrame) / fps;
    const characters = Array.from(scene.text.replace(/\s/gu, "")).length;
    if (!characters || seconds <= 0) continue;
    const allowance = 1 + characters / 20;
    // Avoid noisy warnings for rounding and very small differences.
    if (allowance > seconds + 0.5)
      findings.push(
        ...finding(
          scene.id,
          "reading-time",
          `Copy-length estimate: allow about ${allowance.toFixed(1)}s for this on-screen copy; this scene has ${seconds.toFixed(1)}s. Shorten the copy or review a longer hold.`,
        ),
      );
  }
  return findings.sort((a, b) => a.frame - b.frame);
}
