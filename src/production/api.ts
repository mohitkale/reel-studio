import { z } from "zod";

import { orientationSchema } from "@/lib/orientation";
import { PROVIDER_IDS } from "@/providers/voice/types";

export const productionQualitySchema = z.enum(["draft", "standard", "high"]);
export const productionRunModeSchema = z.enum(["automatic", "approval"]);
export const voiceProviderIdSchema = z.enum(PROVIDER_IDS);

const common = {
  idempotencyKey: z.string().min(8).max(240),
  priority: z.number().int().min(-100).max(100).default(0),
  runMode: productionRunModeSchema.default("automatic"),
};

export const produceContentRequestSchema = z.discriminatedUnion("kind", [
  z.object({
    ...common,
    kind: z.literal("video"),
    scriptId: z.string().min(1),
    voiceTakeId: z.string().min(1).optional(),
    orientation: orientationSchema.optional(),
    quality: productionQualitySchema.default("standard"),
  }),
  z.object({
    ...common,
    kind: z.literal("audio"),
    scriptId: z.string().min(1),
    providerId: voiceProviderIdSchema.optional(),
    voiceId: z.string().min(1).optional(),
    modelId: z.string().min(1).optional(),
    placeholder: z.boolean().default(false),
    label: z.string().trim().min(1).max(120).optional(),
  }),
  z.object({
    ...common,
    kind: z.literal("podcast"),
    podcastId: z.string().min(1),
    regenerateTurnIds: z.array(z.string().min(1)).max(120).optional(),
    label: z.string().trim().min(1).max(120).optional(),
  }),
  z.object({
    ...common,
    kind: z.literal("audiogram"),
    takeId: z.string().min(1),
    startTurnId: z.string().min(1),
    endTurnId: z.string().min(1),
    orientation: orientationSchema.default("portrait"),
    quality: productionQualitySchema.default("standard"),
  }),
]);

export type ProduceContentRequest = z.infer<typeof produceContentRequestSchema>;

export const productionJobIdSchema = z.object({ id: z.string().min(1) });
export const productionEventQuerySchema = z.object({
  after: z.coerce.number().int().nonnegative().default(0),
});
