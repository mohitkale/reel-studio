import { z } from "zod";

export const GRAPHIC_SYMBOLS = [
  "search",
  "answer",
  "sources",
  "document",
  "code",
  "person",
  "growth",
  "target",
  "shield",
  "clock",
  "idea",
  "media",
  "none",
] as const;

/** A small visual grammar, not generated HTML or an unconstrained illustration. */
export const semanticGraphicSchema = z
  .object({
    version: z.literal(1),
    kind: z.enum(["concept", "comparison", "flow"]),
    relationship: z.literal("overlap").optional(),
    nodes: z
      .array(
        z
          .object({
            label: z.string().trim().min(1).max(48),
            detail: z.string().trim().min(1).max(96).optional(),
            symbol: z.enum(GRAPHIC_SYMBOLS),
            /** A frozen verbatim definition elsewhere in this story, never displayed as a new claim. */
            sourceQuote: z.string().trim().min(1).max(240).optional(),
          })
          .strict(),
      )
      .min(1)
      .max(4),
  })
  .strict()
  .superRefine((value, context) => {
    if (
      (value.kind === "concept" && value.nodes.length !== 1) ||
      (value.kind !== "concept" && value.nodes.length < 2)
    )
      context.addIssue({
        code: "custom",
        path: ["nodes"],
        message:
          "Concept needs one subject; comparison and flow need two to four subjects.",
      });
  });
export type SemanticGraphic = z.infer<typeof semanticGraphicSchema>;
