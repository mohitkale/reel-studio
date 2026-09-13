import { z } from "zod";

import { ENERGY_IDS, STYLE_IDS } from "@/compositions/visual-style";
import { VIDEO_ENGINE_IDS } from "@/engines/types";
import { productionSceneRoleSchema } from "@/production/roles";

export const PRODUCTION_PRESET_IDS = [
  "product-launch",
  "editorial-explainer",
  "creator-punch",
  "data-story",
  "developer-demo",
  "cinematic-brand",
] as const;

export const productionPresetIdSchema = z.enum(PRODUCTION_PRESET_IDS);
export type ProductionPresetId = z.infer<typeof productionPresetIdSchema>;

export const productionPresetDefinitionSchema = z.object({
  id: productionPresetIdSchema,
  version: z.string().regex(/^\d+\.\d+\.\d+$/),
  name: z.string().min(1),
  description: z.string().min(1),
  engines: z.array(z.enum(VIDEO_ENGINE_IDS)).min(1),
  sceneRoles: z.array(productionSceneRoleSchema).min(1),
  defaults: z.object({
    styleId: z.enum(STYLE_IDS),
    energy: z.enum(ENERGY_IDS),
    typography: z.enum([
      "display",
      "editorial",
      "creator",
      "data",
      "technical",
      "cinematic",
    ]),
    spacing: z.enum(["compact", "balanced", "spacious"]),
    palette: z.enum([
      "vivid",
      "editorial",
      "creator",
      "data",
      "technical",
      "cinematic",
    ]),
    captionStyle: z.enum([
      "minimal",
      "editorial",
      "karaoke",
      "technical",
      "cinematic",
    ]),
    transition: z.enum([
      "precise",
      "crossfade",
      "beat-cut",
      "data-wipe",
      "terminal-cut",
      "film-dissolve",
    ]),
    minSceneFrames: z.number().int().positive(),
    maxSceneFrames: z.number().int().positive(),
    musicMood: z.string().min(1),
    sfxIntensity: z.number().min(0).max(1),
  }),
});

export type ProductionPresetDefinition = z.infer<
  typeof productionPresetDefinitionSchema
>;

const BOTH_ENGINES = ["hyperframes", "remotion"] as const;

export const PRODUCTION_PRESETS: readonly ProductionPresetDefinition[] = z
  .array(productionPresetDefinitionSchema)
  .parse([
    {
      id: "product-launch",
      version: "1.0.0",
      name: "Product Launch",
      description:
        "A polished hook-to-demo product story with a focused call to action.",
      engines: BOTH_ENGINES,
      sceneRoles: ["hook", "screenshot-demo", "feature", "comparison", "cta"],
      defaults: {
        styleId: "clean-story",
        energy: "normal",
        typography: "display",
        spacing: "balanced",
        palette: "vivid",
        captionStyle: "minimal",
        transition: "precise",
        minSceneFrames: 45,
        maxSceneFrames: 150,
        musicMood: "precise modern product",
        sfxIntensity: 0.35,
      },
    },
    {
      id: "editorial-explainer",
      version: "1.0.0",
      name: "Editorial Explainer",
      description:
        "Readable editorial pacing for ideas, diagrams, quotes, and summaries.",
      engines: BOTH_ENGINES,
      sceneRoles: ["headline", "explanation", "diagram", "quote", "summary"],
      defaults: {
        styleId: "teach-me",
        energy: "calm",
        typography: "editorial",
        spacing: "spacious",
        palette: "editorial",
        captionStyle: "editorial",
        transition: "crossfade",
        minSceneFrames: 75,
        maxSceneFrames: 210,
        musicMood: "thoughtful editorial",
        sfxIntensity: 0.1,
      },
    },
    {
      id: "creator-punch",
      version: "1.0.0",
      name: "Creator Punch",
      description:
        "Fast social storytelling with energetic captions and selective beat accents.",
      engines: BOTH_ENGINES,
      sceneRoles: ["hook", "tip", "emphasis", "payoff", "cta"],
      defaults: {
        styleId: "bold-hook",
        energy: "high",
        typography: "creator",
        spacing: "compact",
        palette: "creator",
        captionStyle: "karaoke",
        transition: "beat-cut",
        minSceneFrames: 30,
        maxSceneFrames: 105,
        musicMood: "energetic creator beat",
        sfxIntensity: 0.7,
      },
    },
    {
      id: "data-story",
      version: "1.0.0",
      name: "Data Story",
      description:
        "Accurate metrics, labeled charts, comparisons, and controlled reveals.",
      engines: BOTH_ENGINES,
      sceneRoles: ["metric", "chart", "comparison", "takeaway"],
      defaults: {
        styleId: "teach-me",
        energy: "normal",
        typography: "data",
        spacing: "balanced",
        palette: "data",
        captionStyle: "minimal",
        transition: "data-wipe",
        minSceneFrames: 60,
        maxSceneFrames: 180,
        musicMood: "controlled analytical pulse",
        sfxIntensity: 0.2,
      },
    },
    {
      id: "developer-demo",
      version: "1.0.0",
      name: "Developer Demo",
      description:
        "Code, diffs, terminal output, and browser proof in a technical narrative.",
      engines: BOTH_ENGINES,
      sceneRoles: ["code", "diff", "terminal", "browser", "cta"],
      defaults: {
        styleId: "clean-story",
        energy: "normal",
        typography: "technical",
        spacing: "balanced",
        palette: "technical",
        captionStyle: "technical",
        transition: "terminal-cut",
        minSceneFrames: 60,
        maxSceneFrames: 180,
        musicMood: "focused technical momentum",
        sfxIntensity: 0.25,
      },
    },
    {
      id: "cinematic-brand",
      version: "1.0.0",
      name: "Cinematic Brand",
      description:
        "Measured photo and video storytelling with testimonials and a refined logo close.",
      engines: BOTH_ENGINES,
      sceneRoles: ["hero", "feature", "testimonial", "logo"],
      defaults: {
        styleId: "soft-brand",
        energy: "calm",
        typography: "cinematic",
        spacing: "spacious",
        palette: "cinematic",
        captionStyle: "cinematic",
        transition: "film-dissolve",
        minSceneFrames: 90,
        maxSceneFrames: 240,
        musicMood: "subtle cinematic texture",
        sfxIntensity: 0.1,
      },
    },
  ]);

export function getProductionPreset(
  id: ProductionPresetId,
  version = "1.0.0",
): ProductionPresetDefinition | undefined {
  return PRODUCTION_PRESETS.find(
    (preset) => preset.id === id && preset.version === version,
  );
}
