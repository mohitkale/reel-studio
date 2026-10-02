import { z } from "zod";
import type { VideoEngineId } from "@/engines/types";
import {
  motionDirectionSchema,
  type MotionDirection,
  type MotionRecipeId,
} from "@/production/motion";

export const motionAnchorSchema = z.enum(["reveal", "impact"]);
export const motionEventSchema = motionDirectionSchema.extend({
  anchor: motionAnchorSchema,
});
export type MotionEvent = z.infer<typeof motionEventSchema>;
type Anchors = { reveal: number; impact?: number };

/** Authored timeline landmarks. HyperFrames uses seconds.
 * Reveal is the start of the primary copy/bar/idea. Impact is the type accent.
 * Keeping the delays here also makes renderer and audio timing share a source.
 */
export const MOTION_EVENT_TIMINGS: Record<
  VideoEngineId,
  Record<MotionRecipeId, Anchors>
> = {
  hyperframes: {
    "type-stack": { reveal: 0.22 },
    "type-impact": { reveal: 0.22, impact: 0.58 },
    "type-editorial": { reveal: 0.22 },
    "data-spotlight": { reveal: 0.1 },
    "data-bars": { reveal: 0.3 },
    "diagram-path": { reveal: 0.22 },
    "diagram-orbit": { reveal: 0.55 },
    "media-device": { reveal: 0.22 },
    "media-cinematic": { reveal: 0.22 },
    "comparison-split": { reveal: 0.2 },
    "comparison-stack": { reveal: 0.2 },
    "quiet-divider": { reveal: 0.2 },
    "quiet-center": { reveal: 0.2 },
    "brand-lockup": { reveal: 0.42 },
    "brand-frame": { reveal: 0.2 },
  },
};

export function motionEventOffsetSeconds(
  direction: MotionDirection,
  anchor: MotionEvent["anchor"],
  engine: VideoEngineId,
  fps: number,
): number | undefined {
  if (
    !motionDirectionSchema.safeParse(direction).success ||
    !Number.isFinite(fps) ||
    fps <= 0
  )
    return undefined;
  const offset = MOTION_EVENT_TIMINGS[engine][direction.recipeId][anchor];
  return offset;
}
