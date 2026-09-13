import { z } from "zod";

import { assertSafeMediaUrl } from "@/lib/media-url-safety";
import { productionChartDataSchema } from "@/production/spec";
import { productionPresetIdSchema } from "@/production/presets";
import { productionSceneRoleSchema } from "@/production/roles";

/** Zod schemas for JSON-shaped DB columns and API inputs. */

export const beatTimingSchema = z.object({
  sceneId: z.string(),
  startFrame: z.number().int().nonnegative(),
  durationFrames: z.number().int().nonnegative(),
  text: z.string(),
});

export const timelineSchema = z.array(beatTimingSchema);

export const captionTimingSourceSchema = z.enum([
  "provider",
  "local-transcription",
  "estimated",
  "imported",
]);
export const captionWordSchema = z
  .object({
    text: z.string().trim().min(1).max(240),
    startFrame: z.number().int().nonnegative(),
    endFrame: z.number().int().positive(),
  })
  .refine((word) => word.endFrame > word.startFrame, {
    message: "Caption word must end after it starts",
  });
export const captionWordsSchema = z.array(captionWordSchema).max(500);

export const voiceModeSchema = z.enum(["oneshot", "per_scene"]);
export const voiceTakeSourceSchema = z.enum(["oneshot", "assembled"]);

export const emphasisSchema = z.array(z.string());

export const paletteSchema = z.object({
  background: z.string().optional(),
  backgroundAccent: z.string().optional(),
  foreground: z.string().optional(),
  muted: z.string().optional(),
  accent: z.string().optional(),
  accentSecondary: z.string().optional(),
  accentForeground: z.string().optional(),
});

export const fontsSchema = z.object({
  fontFamily: z.string().optional(),
});

export const ctaDefaultsSchema = z
  .object({ isDefault: z.boolean().optional() })
  .passthrough();

/** Whole-reel Style + Energy stored in Script.brandOverrides JSON. */
export const visualStyleSchema = z.object({
  styleId: z
    .enum(["bold-hook", "clean-story", "teach-me", "soft-brand"])
    .optional(),
  energy: z.enum(["calm", "normal", "high"]).optional(),
});

export const brandOverridesSchema = z
  .object({
    styleId: z
      .enum(["bold-hook", "clean-story", "teach-me", "soft-brand"])
      .optional(),
    energy: z.enum(["calm", "normal", "high"]).optional(),
    productionPreset: z
      .object({
        id: productionPresetIdSchema,
        version: z.string().regex(/^\d+\.\d+\.\d+$/),
      })
      .optional(),
    creationSource: z
      .object({
        kind: z.enum(["text", "url", "upload"]),
        url: z.string().url().optional(),
        assetIds: z.array(z.string().min(1).max(160)).max(20).optional(),
      })
      .optional(),
    creationOutputType: z.enum(["video", "voiceover"]).optional(),
  })
  .passthrough();

export const panEffectSchema = z.enum([
  "ken-burns",
  "pan-left",
  "pan-right",
  "pan-up",
  "pan-down",
]);

export const sceneBackgroundSchema = z.object({
  type: z.enum(["image", "video"]),
  url: z
    .string()
    .min(1)
    .max(2048)
    .superRefine((url, ctx) => {
      try {
        assertSafeMediaUrl(url);
      } catch (e) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: (e as Error).message,
        });
      }
    }),
  effect: panEffectSchema.optional(),
  muted: z.boolean().optional(),
});

// Broad emotional/visual moods a scene can carry, used to auto-select a
// background treatment (Phase 5) and matching music (Phase 5). Kept small and
// generic so both AI providers and manual JSON authors can target it reliably.
export const sceneMoodSchema = z.enum([
  "energetic",
  "calm",
  "dramatic",
  "playful",
  "inspiring",
  "tech",
  "nature",
]);

export const sceneLocksSchema = z.object({
  copy: z.boolean(),
  assets: z.boolean(),
  scene: z.boolean(),
});
export type SceneLocks = z.infer<typeof sceneLocksSchema>;
export const DEFAULT_SCENE_LOCKS: SceneLocks = {
  copy: false,
  assets: false,
  scene: false,
};

/** Per-scene config stored in the Scene.layoutJson column. */
export const sceneConfigSchema = z.object({
  background: sceneBackgroundSchema.optional(),
  items: z.array(z.string()).optional(),
  chart: productionChartDataSchema.optional(),
  /** Emotional/visual tone, drives the dynamic background treatment + music. */
  mood: sceneMoodSchema.optional(),
  /** Free-text music vibe hint (e.g. "uplifting lo-fi"), used for auto music suggestions. */
  musicMood: z.string().max(60).optional(),
  /** Engine-independent production role retained when the scene is edited. */
  role: productionSceneRoleSchema.optional(),
  /** Selective regeneration controls. */
  locks: sceneLocksSchema.optional(),
});

export const assetRefsSchema = z.array(z.string().min(1).max(160)).max(20);

export const metaSchema = z.record(z.string(), z.unknown());

/** Parse a JSON string column, falling back to a default on null/invalid. */
export function parseJsonColumn<T>(
  raw: string | null | undefined,
  schema: z.ZodType<T>,
  fallback: T,
): T {
  if (!raw) return fallback;
  try {
    const result = schema.safeParse(JSON.parse(raw));
    return result.success ? result.data : fallback;
  } catch {
    return fallback;
  }
}
