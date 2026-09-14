import { videoSnapshotSchema } from "@/production/video-snapshot";
import { z } from "zod";

export const PRODUCTION_JOB_STATES = [
  "queued",
  "running",
  "awaiting_approval",
  "succeeded",
  "failed",
  "canceled",
] as const;
export const productionJobStateSchema = z.enum(PRODUCTION_JOB_STATES);
export type ProductionJobState = z.infer<typeof productionJobStateSchema>;

export const PRODUCTION_STEP_KEYS = [
  "validate",
  "plan",
  "resolve_media",
  "synthesize_audio",
  "time_content",
  "prepare_composition",
  "render_export",
  "verify_artifacts",
] as const;
export const productionStepKeySchema = z.enum(PRODUCTION_STEP_KEYS);
export type ProductionStepKey = z.infer<typeof productionStepKeySchema>;

export const enqueueProductionJobSchema = z.object({
  kind: z.enum(["video", "audio", "podcast", "audiogram", "batch"]),
  idempotencyKey: z.string().min(8).max(240),
  inputSnapshot: z.unknown(),
  priority: z.number().int().min(-100).max(100).default(0),
  state: z.enum(["queued", "awaiting_approval"]).default("queued"),
  batchItemId: z.string().min(1).optional(),
});
export type EnqueueProductionJob = z.input<typeof enqueueProductionJobSchema>;

export const videoProductionJobInputSchema = z.object({
  renderId: z.string().min(1),
  snapshot: videoSnapshotSchema.optional(),
  scriptId: z.string().min(1),
  voiceTakeId: z.string().min(1).optional(),
  orientation: z.enum(["portrait", "landscape", "square"]).optional(),
  quality: z.enum(["draft", "standard", "high"]).default("standard"),
  serverBaseUrl: z.url().default("http://localhost:3000"),
});
export type VideoProductionJobInput = z.infer<
  typeof videoProductionJobInputSchema
>;

export const audiogramProductionJobInputSchema = z.object({
  takeId: z.string().min(1),
  startTurnId: z.string().min(1),
  endTurnId: z.string().min(1),
  orientation: z.enum(["portrait", "landscape", "square"]).default("portrait"),
  quality: z.enum(["draft", "standard", "high"]).default("standard"),
});
export type AudiogramProductionJobInput = z.infer<
  typeof audiogramProductionJobInputSchema
>;

export const audioProductionJobInputSchema = z.object({
  scriptId: z.string().min(1),
  providerId: z
    .enum([
      "kokoro",
      "kokoro-server",
      "webspeech",
      "cartesia",
      "elevenlabs",
      "voiceforge",
    ])
    .optional(),
  voiceId: z.string().min(1).optional(),
  modelId: z.string().min(1).optional(),
  placeholder: z.boolean().default(false),
  label: z.string().min(1).max(120).optional(),
});

export const podcastProductionJobInputSchema = z.object({
  podcastId: z.string().min(1),
  regenerateTurnIds: z.array(z.string().min(1)).max(120).optional(),
  label: z.string().min(1).max(120).optional(),
});

export interface ClaimedProductionJob {
  id: string;
  kind: string;
  state: "running";
  inputSnapshot: unknown;
  attempt: number;
  cancelRequested: boolean;
  leaseOwner: string;
  leaseExpiresAt: Date;
}
