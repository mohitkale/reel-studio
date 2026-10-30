import { z } from "zod";
import { AI_PROVIDER_IDS, SCRIPT_STYLES } from "@/providers/ai/types";
import { orientationSchema } from "@/lib/orientation";
import { VIDEO_ENGINE_IDS } from "@/engines/types";
import { productionPresetIdSchema } from "@/production/presets";
import { mediaPreferenceSchema } from "@/lib/media-preference";
import { quickProduceOptionsSchema } from "@/production/quick-produce";
import { directorBudgetSchema } from "@/video/shot-direction";
import { visualAmbitionSchema } from "@/production/motion-plan";

export const projectCreationRequestSchema = z.object({
  providerId: z.enum(AI_PROVIDER_IDS).optional(),
  modelId: z.string().optional(),
  mode: z.enum(["idea", "story"]),
  brief: z.string().trim().min(3).max(8000),
  sceneCount: z.number().int().min(3).max(20).optional(),
  orientation: orientationSchema.optional(),
  scriptStyle: z.enum(SCRIPT_STYLES).optional(),
  videoEngine: z.enum(VIDEO_ENGINE_IDS).optional(),
  /** "auto" lets the AI choose; otherwise lock Style for the whole reel. */
  styleId: z
    .enum(["auto", "bold-hook", "clean-story", "teach-me", "soft-brand"])
    .optional(),
  /** "auto" lets the AI choose; otherwise lock Energy. */
  energy: z.enum(["auto", "calm", "normal", "high"]).optional(),
  visualAmbition: visualAmbitionSchema.default("expressive"),
  /** Automatic colour direction unless a brand is explicitly selected. */
  brandKitId: z.string().trim().min(1).max(120).nullable().default(null),
  productionPresetId: productionPresetIdSchema
    .or(z.literal("auto"))
    .default("auto"),
  mediaPreference: mediaPreferenceSchema.default("auto"),
  quickProduce: quickProduceOptionsSchema.optional(),
  idempotencyKey: z.string().min(8).max(240).optional(),
  directorBudget: directorBudgetSchema.optional(),
  evidenceId: z.string().trim().min(1).max(160).optional(),
});
