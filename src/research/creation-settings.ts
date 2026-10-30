import { z } from "zod";
import { AI_PROVIDER_IDS, SCRIPT_STYLES } from "@/providers/ai/types";
import { orientationSchema } from "@/lib/orientation";
import { mediaPreferenceSchema } from "@/lib/media-preference";
import { quickProduceOptionsSchema } from "@/production/quick-produce";
import { productionPresetIdSchema } from "@/production/presets";
import { visualAmbitionSchema } from "@/production/motion-plan";

export const creationSettingsSchema = z.object({
  brief: z.string().min(3).max(8000),
  mode: z.enum(["idea", "story"]),
  writer: z
    .object({
      providerId: z.enum(AI_PROVIDER_IDS),
      modelId: z.string().min(1).max(160),
    })
    .optional(),
  orientation: orientationSchema,
  scriptStyle: z.enum(SCRIPT_STYLES).optional(),
  sceneCount: z.number().int().min(3).max(20).optional(),
  styleId: z
    .enum(["bold-hook", "clean-story", "teach-me", "soft-brand"])
    .optional(),
  energy: z.enum(["calm", "normal", "high"]).optional(),
  visualAmbition: visualAmbitionSchema.optional(),
  brandKitId: z.string().nullable(),
  mediaPreference: mediaPreferenceSchema,
  productionPresetId: productionPresetIdSchema,
  quickProduce: quickProduceOptionsSchema.optional(),
});
export type CreationSettings = z.infer<typeof creationSettingsSchema>;
