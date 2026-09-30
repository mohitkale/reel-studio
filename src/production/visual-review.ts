import { z } from "zod";
import type { ReelBeat } from "@/compositions/types";

export const visualReviewRequestSchema = z
  .object({
    sceneIds: z.array(z.string().min(1)).min(1).max(8),
    samples: z.union([z.literal(1), z.literal(4)]).default(1),
    voiceTakeId: z.string().min(1).optional(),
  })
  .strict()
  .refine((value) => new Set(value.sceneIds).size === value.sceneIds.length, {
    message: "Choose each scene only once.",
  })
  .refine((value) => value.sceneIds.length * value.samples <= 8, {
    message: "Review up to eight stills per request.",
  });
export type VisualReviewRequest = z.infer<typeof visualReviewRequestSchema>;

export interface ReviewPoint {
  sceneId: string;
  sceneNumber: number;
  frame: number;
  label: string;
}

/** Integer frame sampling stays inside the scene, including one-frame clips. */
export function planVisualReview(
  timeline: readonly ReelBeat[],
  sceneIds: readonly string[],
  samples: 1 | 4,
  coverFrames = 0,
): ReviewPoint[] {
  const selected = new Set(sceneIds);
  const points = timeline.flatMap((beat, index) => {
    if (!selected.has(beat.sceneId)) return [];
    if (beat.durationFrames < 1)
      throw new Error("Cannot review an empty scene.");
    const positions =
      samples === 4
        ? ([
            [0.1, "Opening"],
            [0.35, "Reveal"],
            [0.65, "Reading"],
            [0.9, "Closing"],
          ] as const)
        : ([[0.65, "Reading"]] as const);
    const seen = new Set<number>();
    return positions.flatMap(([fraction, label]) => {
      const frame =
        coverFrames +
        beat.startFrame +
        Math.min(
          beat.durationFrames - 1,
          Math.floor(beat.durationFrames * fraction),
        );
      if (seen.has(frame)) return [];
      seen.add(frame);
      return [{ sceneId: beat.sceneId, sceneNumber: index + 1, frame, label }];
    });
  });
  if (new Set(points.map((point) => point.sceneId)).size !== selected.size)
    throw new Error("A selected scene no longer exists in this video.");
  return points;
}

export interface VisualReviewResult {
  revision: string;
  videoEngine: "remotion" | "hyperframes";
  width: number;
  height: number;
  fps: number;
  takeUsable: boolean;
  stills: Array<ReviewPoint & { url: string }>;
}
