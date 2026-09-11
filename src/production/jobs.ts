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
});
export type EnqueueProductionJob = z.input<typeof enqueueProductionJobSchema>;

export const videoProductionJobInputSchema = z.object({
  renderId: z.string().min(1),
  scriptId: z.string().min(1),
  voiceTakeId: z.string().min(1).optional(),
  orientation: z.enum(["portrait", "landscape", "square"]).optional(),
  quality: z.enum(["draft", "standard", "high"]).default("standard"),
  serverBaseUrl: z.url().default("http://localhost:3000"),
});
export type VideoProductionJobInput = z.infer<
  typeof videoProductionJobInputSchema
>;

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
