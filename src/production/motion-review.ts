import {
  motionFallbackReason,
  type MotionDirection,
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
