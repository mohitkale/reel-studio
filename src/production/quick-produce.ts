import { z } from "zod";

import { mediaPreferenceSchema } from "@/lib/media-preference";
import { AI_PROVIDER_IDS } from "@/providers/ai/types";
import { PROVIDER_IDS } from "@/providers/voice/types";

export const QUICK_PRODUCE_PLANNERS = [
  "deterministic",
  ...AI_PROVIDER_IDS,
] as const;
export const DEFAULT_QUICK_PRODUCE_ENABLED = false;

export const quickProduceOptionsSchema = z
  .object({
    enabled: z.literal(true),
    planner: z.enum(QUICK_PRODUCE_PLANNERS).default("deterministic"),
    plannerModelId: z.string().min(1).optional(),
    mediaPreference: mediaPreferenceSchema.default("auto"),
    voice: z
      .object({
        enabled: z.boolean().default(true),
        providerId: z.enum(PROVIDER_IDS).default("kokoro-server"),
        voiceId: z.string().min(1).default("af_heart"),
        modelId: z.string().min(1).optional(),
      })
      .default({
        enabled: true,
        providerId: "kokoro-server",
        voiceId: "af_heart",
      }),
  })
  .strict();

export type QuickProduceOptions = z.infer<typeof quickProduceOptionsSchema>;
