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
  "agent",
  "cloud",
  "device",
  "moon",
  "cycle",
  "orbit",
  "none",
] as const;

export const SHOWPIECES = [
  {
    id: "depth-focus",
    name: "Depth reveal",
    description:
      "A macro detail opens into a dimensional subject and its explanation.",
  },
  {
    id: "orbital-comparison",
    name: "Orbit & compare",
    description:
      "Subjects assemble in depth, then the camera connects their differences.",
  },
  {
    id: "branch-cascade",
    name: "Growing hierarchy",
    description:
      "A root grows into named teams with a connected hiring cascade.",
  },
  {
    id: "signal-routing",
    name: "Signal architecture",
    description:
      "A system builds node by node, then signals travel through its connections.",
  },
  {
    id: "kinetic-handoff",
    name: "Work in motion",
    description:
      "An active work token moves through supplied steps while each owner takes focus.",
  },
  {
    id: "device-evolution",
    name: "Product evolution",
    description:
      "One dimensional device carries the supplied stages from draft to result.",
  },
  {
    id: "lunar-cycle",
    name: "Lunar phases",
    description:
      "A shaded moon develops through an illustrative phase cycle, with a persistent phase rail.",
  },
  {
    id: "year-cycle",
    name: "Seasonal wheel",
    description:
      "A layered almanac dial unfolds into a rotating cycle with botanical details.",
  },
  {
    id: "sky-orbit",
    name: "Orbital rhythms",
    description:
      "A constellation assembles inside moving orbital paths, with a stable central focus.",
  },
] as const;
export const showpieceIdSchema = z.enum(SHOWPIECES.map((piece) => piece.id));
export type ShowpieceId = z.infer<typeof showpieceIdSchema>;
export const showpieceEventSchema = z
  .object({
    version: z.literal(1),
    presentation: showpieceIdSchema,
    subjectIndex: z.number().int().min(0).max(7),
    moment: z.enum(["arrive", "resolve"]),
  })
  .strict();
export type ShowpieceEvent = z.infer<typeof showpieceEventSchema>;

/** A small visual grammar, not generated HTML or an unconstrained illustration. */
export const semanticGraphicSchema = z
  .object({
    version: z.literal(1),
    kind: z.enum(["concept", "comparison", "flow", "hierarchy", "system"]),
    presentation: showpieceIdSchema.optional(),
    relationship: z.literal("overlap").optional(),
    nodes: z
      .array(
        z
          .object({
            label: z.string().trim().min(1).max(48),
            detail: z.string().trim().min(1).max(96).optional(),
            symbol: z.enum(GRAPHIC_SYMBOLS),
            parent: z.number().int().min(0).max(7).optional(),
            /** A frozen verbatim definition elsewhere in this story, never displayed as a new claim. */
            sourceQuote: z.string().trim().min(1).max(240).optional(),
          })
          .strict(),
      )
      .min(1)
      .max(8),
  })
  .strict()
  .superRefine((value, context) => {
    if (
      (value.kind === "concept" && value.nodes.length !== 1) ||
      (value.kind !== "concept" && value.nodes.length < 2) ||
      (value.kind === "comparison" && value.nodes.length > 4) ||
      (["flow", "system"].includes(value.kind) && value.nodes.length > 6)
    )
      context.addIssue({
        code: "custom",
        path: ["nodes"],
        message:
          "Concept needs one subject; comparison supports 2–4, flow/system 2–6, hierarchy 2–8.",
      });
    value.nodes.forEach((node, index) => {
      if (
        node.parent !== undefined &&
        (value.kind !== "hierarchy" || node.parent >= index)
      )
        context.addIssue({
          code: "custom",
          path: ["nodes", index, "parent"],
          message:
            "Hierarchy parents must precede their children; the root has no parent.",
        });
    });
  });
export type SemanticGraphic = z.infer<typeof semanticGraphicSchema>;
