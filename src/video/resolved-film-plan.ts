import { adaptiveLayoutSchema } from "./adaptive-layout";
import { z } from "zod";
import {
  adaptiveRecipeManifestSchema,
  recipeIdSchema,
  recipeVersionSchema,
} from "./adaptive-recipe";

export const filmDigestSchema = z.string().regex(/^sha256:[a-f0-9]{64}$/);
const referenceSchema = z.string().min(1).max(240);
const frame = z.number().int().nonnegative();

/** M1 freezes existing choices; geometry remains owned by the pinned renderer. */
export const resolvedFilmPlanSchema = z
  .object({
    schemaVersion: z.literal(1),
    resolverVersion: z.enum(["1.0.0", "1.1.0"]),
    mode: z.enum(["compatibility", "adaptive"]),
    sourceHash: filmDigestSchema,
    scriptId: referenceSchema,
    seed: z.string().min(1).max(240),
    canvas: z
      .object({
        width: z.number().int().positive().max(7680),
        height: z.number().int().positive().max(7680),
        fps: z.number().int().min(1).max(120),
      })
      .strict(),
    timing: z
      .object({
        source: z.enum(["estimated", "take", "mixed"]),
        contentFrames: z.number().int().positive(),
        coverFrames: frame,
        totalFrames: z.number().int().positive(),
      })
      .strict(),
    catalogRevision: z.string().min(1).max(160),
    recipes: z
      .array(
        z
          .object({
            manifest: adaptiveRecipeManifestSchema,
            hash: filmDigestSchema,
          })
          .strict(),
      )
      .min(1)
      .max(240),
    shots: z
      .array(
        z
          .object({
            id: referenceSchema,
            sceneId: referenceSchema,
            order: frame,
            startFrame: frame,
            durationFrames: z.number().int().positive(),
            recipe: z
              .object({
                id: recipeIdSchema,
                version: recipeVersionSchema,
                hash: filmDigestSchema,
              })
              .strict(),
            binding: z
              .object({
                kind: z.literal("snapshot-scene"),
                sceneHash: filmDigestSchema,
              })
              .strict(),
            layout: z.enum(["existing-renderer", "adaptive"]),
            adaptive: adaptiveLayoutSchema.optional(),
            fallbackReason: z.string().optional(),
            reason: z.literal(
              "Preserve saved scene content, direction, media and locks.",
            ),
          })
          .strict(),
      )
      .min(1)
      .max(240),
  })
  .strict()
  .superRefine((plan, ctx) => {
    if (
      plan.timing.totalFrames !==
      plan.timing.contentFrames + plan.timing.coverFrames
    )
      ctx.addIssue({
        code: "custom",
        path: ["timing"],
        message: "Invalid total frame count",
      });
    const hasAdaptive = plan.shots.some((s) => s.adaptive);
    if (
      (plan.mode === "adaptive") !== hasAdaptive ||
      (hasAdaptive && plan.resolverVersion !== "1.1.0")
    )
      ctx.addIssue({
        code: "custom",
        message: "Adaptive plans require resolver 1.1.0 and adaptive mode",
      });
    const recipes = new Map(
      plan.recipes.map((r) => [`${r.manifest.id}@${r.manifest.version}`, r]),
    );
    if (recipes.size !== plan.recipes.length)
      ctx.addIssue({
        code: "custom",
        path: ["recipes"],
        message: "Duplicate recipe versions",
      });
    const ids = new Set<string>();
    const scenes = new Set<string>();
    let end = 0;
    for (const [i, shot] of plan.shots.entries()) {
      const recipe = recipes.get(`${shot.recipe.id}@${shot.recipe.version}`);
      if (
        !recipe ||
        recipe.hash !== shot.recipe.hash ||
        recipe.manifest.mode !==
          (shot.layout === "adaptive" ? "adaptive" : "compatibility")
      )
        ctx.addIssue({
          code: "custom",
          path: ["shots", i, "recipe"],
          message: "Unknown or incompatible recipe reference",
        });
      if (
        (shot.layout === "adaptive") !== Boolean(shot.adaptive) ||
        (shot.adaptive &&
          (shot.adaptive.recipeId !== shot.recipe.id ||
            shot.adaptive.recipeVersion !== shot.recipe.version ||
            shot.adaptive.width !== plan.canvas.width ||
            shot.adaptive.height !== plan.canvas.height))
      )
        ctx.addIssue({
          code: "custom",
          path: ["shots", i],
          message: "Adaptive layout does not match its recipe or canvas",
        });
      if (ids.has(shot.id) || scenes.has(shot.sceneId) || shot.order !== i)
        ctx.addIssue({
          code: "custom",
          path: ["shots", i],
          message:
            "Shots require unique IDs, scene bindings and contiguous order",
        });
      if (
        shot.startFrame < end ||
        shot.startFrame + shot.durationFrames > plan.timing.contentFrames
      )
        ctx.addIssue({
          code: "custom",
          path: ["shots", i],
          message: "Shot overlaps or exceeds content timing",
        });
      ids.add(shot.id);
      scenes.add(shot.sceneId);
      end = shot.startFrame + shot.durationFrames;
    }
  });
export type ResolvedFilmPlan = z.infer<typeof resolvedFilmPlanSchema>;
