import { z } from "zod";

/** Data-only capability contracts. A manifest never supplies executable code. */
export const recipeIdSchema = z.string().regex(/^[a-z][a-z0-9.-]{0,95}$/);
export const recipeVersionSchema = z.string().regex(/^\d+\.\d+\.\d+$/);
const rangeSchema = z
  .object({
    min: z.number().finite().nonnegative(),
    max: z.number().finite().nonnegative(),
  })
  .strict()
  .refine((value) => value.min <= value.max, "Invalid capability range");

export const adaptiveRecipeManifestSchema = z
  .object({
    schemaVersion: z.literal(1),
    id: recipeIdSchema,
    version: recipeVersionSchema,
    name: z.string().min(1).max(120),
    mode: z.enum(["compatibility", "adaptive"]),
    intents: z
      .array(
        z.enum([
          "existing-scene",
          "explanation",
          "comparison",
          "process",
          "evidence",
          "media",
          "navigation",
        ]),
      )
      .min(1)
      .max(8),
    inputs: z
      .array(
        z
          .object({
            name: recipeIdSchema,
            kind: z.enum([
              "scene-reference",
              "text",
              "subjects",
              "ordered-steps",
              "chart",
              "media-reference",
            ]),
            required: z.boolean(),
          })
          .strict(),
      )
      .min(1)
      .max(16),
    durationSeconds: rangeSchema,
    density: z
      .object({ characters: rangeSchema, subjects: rangeSchema })
      .strict(),
    aspects: z
      .array(
        z
          .object({
            format: z.enum(["portrait", "landscape", "square"]),
            strategy: z.enum(["existing-renderer", "reflow", "stage", "stack"]),
          })
          .strict(),
      )
      .min(1)
      .max(3),
    tokenSlots: z
      .array(
        z.enum([
          "background",
          "foreground",
          "accent",
          "accentSecondary",
          "fontFamily",
          "radius",
        ]),
      )
      .max(6),
    events: z
      .array(
        z
          .object({
            id: recipeIdSchema,
            phase: z.enum([
              "establish",
              "reveal",
              "relate",
              "emphasize",
              "resolve",
            ]),
          })
          .strict(),
      )
      .max(16),
    continuityPorts: z
      .array(
        z
          .object({
            id: recipeIdSchema,
            direction: z.enum(["entry", "exit"]),
            kind: z.enum(["subject", "card", "media"]),
          })
          .strict(),
      )
      .max(16),
    resourceClass: z.enum(["unmeasured", "light", "moderate", "heavy"]),
    fallback: z
      .array(
        z.object({ id: recipeIdSchema, version: recipeVersionSchema }).strict(),
      )
      .max(8),
    provenance: z
      .object({
        origin: z.enum(["bundled", "adapted"]),
        license: z.string().min(1).max(100),
        revision: z.string().min(1).max(160),
      })
      .strict(),
    fixtureIds: z.array(recipeIdSchema).max(32),
  })
  .strict()
  .superRefine((manifest, ctx) => {
    for (const [field, values] of [
      ["inputs", manifest.inputs.map((v) => v.name)],
      ["aspects", manifest.aspects.map((v) => v.format)],
      ["events", manifest.events.map((v) => v.id)],
      ["continuityPorts", manifest.continuityPorts.map((v) => v.id)],
      ["tokenSlots", manifest.tokenSlots],
      ["intents", manifest.intents],
      ["fixtureIds", manifest.fixtureIds],
      ["fallback", manifest.fallback.map((v) => `${v.id}@${v.version}`)],
    ] as const) {
      if (new Set(values).size !== values.length)
        ctx.addIssue({
          code: "custom",
          path: [field],
          message: "Duplicate capability identifiers",
        });
    }
    if (
      manifest.fallback.some(
        (v) => v.id === manifest.id && v.version === manifest.version,
      )
    )
      ctx.addIssue({
        code: "custom",
        path: ["fallback"],
        message: "A recipe cannot fall back to itself",
      });
  });
export type AdaptiveRecipeManifest = z.infer<
  typeof adaptiveRecipeManifestSchema
>;
