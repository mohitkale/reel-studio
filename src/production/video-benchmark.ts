import { z } from "zod";

export const videoBenchmarkProfileSchema = z.enum([
  "draft-720",
  "standard-720",
  "high-1080",
]);
export type VideoBenchmarkProfileId = z.infer<
  typeof videoBenchmarkProfileSchema
>;
/** Native coordinates are held fixed within a canvas tier. Engine quality
 * output scaling differs; reports must retain the measured encoded dimensions.
 */
export const VIDEO_BENCHMARK_PROFILES = {
  "draft-720": {
    quality: "draft",
    width: 1280,
    height: 720,
    seconds: 300,
    fps: 24,
  },
  "standard-720": {
    quality: "standard",
    width: 1280,
    height: 720,
    seconds: 300,
    fps: 24,
  },
  "high-1080": {
    quality: "high",
    width: 1920,
    height: 1080,
    seconds: 300,
    fps: 24,
  },
} as const;
export const finishingExperimentSchema = z
  .object({
    quality: z.literal("high"),
    mode: z.literal("temporal-blend-3"),
    fps: z.union([z.literal(24), z.literal(30), z.literal(60)]),
    totalFrames: z.number().int().positive(),
    cutFrames: z.array(z.number().int().nonnegative()).max(240),
  })
  .strict()
  .superRefine((input, ctx) => {
    if (input.totalFrames > input.fps * 300)
      ctx.addIssue({
        code: "custom",
        message: "Finishing experiments are limited to five minutes.",
      });
    if (
      input.cutFrames.some(
        (frame, index) =>
          frame >= input.totalFrames ||
          (index > 0 && frame <= input.cutFrames[index - 1]),
      )
    )
      ctx.addIssue({
        code: "custom",
        message: "Cuts must be ordered, unique and inside the video.",
      });
  });
export type FinishingExperiment = z.infer<typeof finishingExperimentSchema>;
export const TEMPORAL_BLEND_FILTER = "tmix=frames=3:weights='1 2 1'";
