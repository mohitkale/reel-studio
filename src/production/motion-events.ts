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

/** Authored timeline landmarks. HF uses seconds; Remotion uses local frames.
 * Reveal is the start of the primary copy/bar/idea. Impact is the type accent.
 * Keeping the delays here also makes renderer and audio timing share a source.
 */
export const MOTION_EVENT_TIMINGS: Record<
  VideoEngineId,
  Record<MotionRecipeId, Anchors>
> = {
  hyperframes: {
    "type-impact": { reveal: 0.22, impact: 0.58 },
    "type-editorial": { reveal: 0.22 },
    "data-spotlight": { reveal: 0.1 },
    "data-bars": { reveal: 0.3 },
    "diagram-path": { reveal: 0.22 },
    "diagram-orbit": { reveal: 0.55 },
    "media-device": { reveal: 0.22 },
    "media-cinematic": { reveal: 0.22 },
  },
  remotion: {
    "type-impact": { reveal: 4, impact: 17 },
    "type-editorial": { reveal: 8 },
    "data-spotlight": { reveal: 4 },
    "data-bars": { reveal: 10 },
    "diagram-path": { reveal: 8 },
    "diagram-orbit": { reveal: 11 },
    "media-device": { reveal: 0 },
    "media-cinematic": { reveal: 0 },
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
  return offset === undefined
    ? undefined
    : engine === "remotion"
      ? offset / fps
      : offset;
}
