import { z } from "zod";
import { PROVIDER_IDS } from "@/providers/voice/types";
import { podcastPronunciationsSchema } from "@/library/podcast-schemas";
export const studioPresetSchema = z.object({
  name: z.string().trim().min(1).max(80),
  voice: z
    .object({
      providerId: z.enum(PROVIDER_IDS),
      voiceId: z.string().min(1).max(200),
      modelId: z.string().max(200).optional(),
    })
    .optional(),
  pronunciations: podcastPronunciationsSchema.default([]),
});
export type StudioPreset = z.infer<typeof studioPresetSchema>;

/** Omitted sections are preserved when updating an existing named preset. */
export const studioPresetInputSchema = studioPresetSchema.extend({
  pronunciations: podcastPronunciationsSchema.optional(),
});
