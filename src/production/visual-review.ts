import type { LayoutEvidence } from "@/production/visual-review-layout";
import { z } from "zod";
import type { ReelBeat } from "@/video/types";
import type { VisualReviewFinding } from "@/production/visual-review-findings";

export const visualReviewRequestSchema = z
  .object({
    sceneIds: z.array(z.string().min(1)).min(1).max(8),
    samples: z.union([z.literal(1), z.literal(4)]).default(1),
    voiceTakeId: z.string().min(1).optional(),
    mode: z.enum(["scene", "transition"]).default("scene"),
  })
  .strict()
  .refine((value) => new Set(value.sceneIds).size === value.sceneIds.length, {
    message: "Choose each scene only once.",
  })
  .refine((value) => value.sceneIds.length * value.samples <= 8, {
    message: "Review up to eight stills per request.",
  })
  .refine(
    (value) =>
      value.mode !== "transition" ||
      (value.sceneIds.length === 1 && value.samples === 1),
    {
      message: "Choose one incoming scene for a transition strip.",
    },
  );
export type VisualReviewRequest = z.input<typeof visualReviewRequestSchema>;

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
  layoutReview?: {
    status: "sampled" | "unavailable";
    frames: number[];
    contrastCheckedTextNodes?: number;
  };
  revision: string;
  videoEngine: "hyperframes";
  width: number;
  height: number;
  fps: number;
  takeUsable: boolean;
  findings: VisualReviewFinding[];
  stills: Array<ReviewPoint & { url: string; layout?: LayoutEvidence }>;
}

/** Eight bounded frames around an actual cut, including the outgoing hold. */
export function planTransitionReview(
  timeline: readonly ReelBeat[],
  incomingSceneId: string,
  fps: number,
  cover = 0,
): ReviewPoint[] {
  const index = timeline.findIndex((beat) => beat.sceneId === incomingSceneId);
  if (index < 1)
    throw new Error("Choose a scene with a preceding scene to review its cut.");
  if (!Number.isFinite(fps) || fps <= 0)
    throw new Error("Transition review needs a valid frame rate.");
  const current = timeline[index],
    previous = timeline[index - 1];
  const end =
    timeline[index + 1]?.startFrame ??
    current.startFrame + current.durationFrames;
  if (current.startFrame <= previous.startFrame || end <= current.startFrame)
    throw new Error("Transition review needs nonempty scene timing.");
  const frames = new Set(
    [-0.25, -0.1, -1 / fps, 0, 1 / fps, 0.1, 0.25, 0.4].map((offset) =>
      Math.min(
        end - 1,
        Math.max(
          previous.startFrame,
          current.startFrame + Math.round(offset * fps),
        ),
      ),
    ),
  );
  return [...frames]
    .sort((a, b) => a - b)
    .map((frame) => ({
      sceneId: frame < current.startFrame ? previous.sceneId : current.sceneId,
      sceneNumber: frame < current.startFrame ? index : index + 1,
      frame: cover + frame,
      label:
        frame < current.startFrame
          ? "Before cut"
          : frame === current.startFrame
            ? "Cut"
            : "After cut",
    }));
}
