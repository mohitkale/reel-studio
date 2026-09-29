import {
  motionFallbackReason,
  resolveMotionDirection,
  type MotionDirection,
  type MotionRecipeId,
} from "@/production/motion";
import type { MotionPlanScene } from "@/production/motion-plan";

export interface MotionReviewScene extends Pick<
  MotionPlanScene,
  "text" | "chart" | "items" | "background" | "hasVisualContent"
> {
  id: string;
  motion?: MotionDirection;
  hideText?: boolean;
}

/** Input compatibility only. Uses the renderers' shared fallback contract. */
export function reviewMotionTreatments(scenes: readonly MotionReviewScene[]) {
  return scenes.flatMap((scene, index) => {
    // Hidden copy intentionally bypasses motion; an original preset needs no check.
    if (!scene.motion || scene.hideText) return [];
    const reason = motionFallbackReason(
      scene.motion,
      scene.text,
      scene.chart,
      Boolean(scene.hasVisualContent),
      scene.items,
      scene.background,
    );
    return reason
      ? [{ sceneId: scene.id, sceneNumber: index + 1, reason }]
      : [];
  });
}

/** Suggest reviewing runs of three or more active, identical treatments.
 * Original presets, hidden copy and input fallbacks break the run. Repetition
 * can be intentional, so this never changes a scene or prevents export.
 */
export function reviewMotionRepetition(scenes: readonly MotionReviewScene[]) {
  const suggestions: Array<{
    sceneId: string;
    firstSceneNumber: number;
    lastSceneNumber: number;
    recipeId: MotionRecipeId;
  }> = [];
  let start = 0;
  let previous: MotionDirection | undefined;
  // A final empty scene closes the last run without special-case reporting.
  for (let index = 0; index <= scenes.length; index++) {
    const scene = scenes[index];
    const current =
      scene && !scene.hideText
        ? resolveMotionDirection(
            scene.motion,
            scene.text,
            scene.chart,
            Boolean(scene.hasVisualContent),
            scene.items,
            scene.background,
          )
        : undefined;
    if (current?.recipeId === previous?.recipeId) continue;
    if (previous && index - start >= 3) {
      suggestions.push({
        sceneId: scenes[start].id,
        firstSceneNumber: start + 1,
        lastSceneNumber: index,
        recipeId: previous.recipeId,
      });
    }
    start = index;
    previous = current;
  }
  return suggestions;
}
