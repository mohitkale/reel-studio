import { z } from "zod";
import { ADAPTIVE_RECIPES } from "./adaptive-catalog";
const box = z
  .object({
    x: z.number().finite(),
    y: z.number().finite(),
    width: z.number().positive(),
    height: z.number().positive(),
  })
  .strict();
export const adaptiveLayoutSchema = z
  .object({
    version: z.literal(1),
    recipeId: z.enum(ADAPTIVE_RECIPES.map((r) => r.id)),
    recipeVersion: z.literal("1.0.0"),
    system: z.enum(["editorial", "precision", "poster"]),
    variant: z.enum([
      "focus",
      "reading",
      "columns",
      "stack",
      "grid",
      "route",
      "metric",
      "ledger",
      "bars",
      "media-side",
      "media-stack",
    ]),
    width: z.number().positive(),
    height: z.number().positive(),
    duration: z.number().positive(),
    headline: box.extend({ fontSize: z.number().positive() }),
    panels: z
      .array(
        box.extend({
          index: z.number().int().nonnegative(),
          fontSize: z.number().positive(),
          at: z.number().nonnegative(),
          focus: z.number().nonnegative(),
        }),
      )
      .max(6),
    source: box.extend({ fontSize: z.number().positive() }).optional(),
    entrance: z.number().positive(),
    reason: z.string(),
    warnings: z.array(z.string()),
  })
  .strict();
export type AdaptiveLayout = z.infer<typeof adaptiveLayoutSchema>;
