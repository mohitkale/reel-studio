import { z } from "zod";

import { orientationFromDims, orientationSchema } from "@/lib/orientation";

export const productionLayoutSchema = z.object({
  orientation: orientationSchema,
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  safeArea: z.object({
    top: z.number().int().nonnegative(),
    right: z.number().int().nonnegative(),
    bottom: z.number().int().nonnegative(),
    left: z.number().int().nonnegative(),
  }),
  contentMaxWidth: z.number().int().positive(),
  captionMaxWidth: z.number().int().positive(),
  captionBottom: z.number().int().nonnegative(),
  brandInsetBottom: z.number().int().nonnegative(),
  progressBarHeight: z.number().int().positive(),
  typeScale: z.number().positive(),
  mediaFit: z.enum(["cover", "contain"]),
});
export type ProductionLayout = z.infer<typeof productionLayoutSchema>;

const LAYOUT_PROPORTIONS = {
  portrait: {
    top: 0.078,
    side: 0.089,
    bottom: 0.115,
    contentWidth: 0.82,
    captionWidth: 0.86,
    captionBottom: 0.075,
    brandBottom: 0.033,
    progress: 0.0042,
    typeScale: 1,
  },
  landscape: {
    top: 0.075,
    side: 0.075,
    bottom: 0.1,
    contentWidth: 0.72,
    captionWidth: 0.68,
    captionBottom: 0.07,
    brandBottom: 0.04,
    progress: 0.0056,
    typeScale: 1,
  },
  square: {
    top: 0.08,
    side: 0.08,
    bottom: 0.13,
    contentWidth: 0.84,
    captionWidth: 0.84,
    captionBottom: 0.08,
    brandBottom: 0.045,
    progress: 0.0056,
    typeScale: 0.92,
  },
} as const;

/** Resolve format-specific safe areas without cropping a completed composition. */
export function resolveProductionLayout(input: {
  width: number;
  height: number;
}): ProductionLayout {
  const orientation = orientationFromDims(input.width, input.height);
  const rules = LAYOUT_PROPORTIONS[orientation];
  const shortest = Math.min(input.width, input.height);
  const side = Math.round(input.width * rules.side);

  return productionLayoutSchema.parse({
    orientation,
    width: input.width,
    height: input.height,
    safeArea: {
      top: Math.round(input.height * rules.top),
      right: side,
      bottom: Math.round(input.height * rules.bottom),
      left: side,
    },
    contentMaxWidth: Math.round(input.width * rules.contentWidth),
    captionMaxWidth: Math.round(input.width * rules.captionWidth),
    captionBottom: Math.round(input.height * rules.captionBottom),
    brandInsetBottom: Math.round(input.height * rules.brandBottom),
    progressBarHeight: Math.max(4, Math.round(input.height * rules.progress)),
    typeScale: rules.typeScale * (shortest / 1080),
    mediaFit: "cover",
  });
}
