import { z } from "zod";
import {
  stockProviderIdSchema,
  stockMediaSearchRequestSchema,
  stockMediaCandidateSchema,
} from "@/providers/stock/schemas";
import { mediaVisionAssessmentSchema } from "./media-ranking-contract";
export const mediaVisionRequestSchema = z
  .object({
    idempotencyKey: z.string().trim().min(8).max(160),
    expectedHash: z.string().length(64),
    sceneId: z.string().min(1).max(160),
    stockProviderId: stockProviderIdSchema,
    search: stockMediaSearchRequestSchema,
    candidateIds: z
      .array(z.string().min(1).max(2048))
      .min(1)
      .max(6)
      .refine(
        (ids) => new Set(ids).size === ids.length,
        "Choose distinct candidates",
      ),
    modelId: z.string().trim().min(1).max(160),
    budget: z
      .object({
        maxProviderCalls: z.literal(1),
        maxImages: z.literal(6),
        deadlineMs: z.number().int().min(1000).max(30000),
      })
      .strict(),
  })
  .strict();
export type MediaVisionRequest = z.infer<typeof mediaVisionRequestSchema>;
export const mediaVisionControlSchema = z
  .object({ action: z.enum(["cancel", "resume"]) })
  .strict();
export const mediaVisionJobSchema = z
  .object({
    id: z.string(),
    scriptId: z.string(),
    sceneId: z.string(),
    sourceHash: z.string().length(64),
    state: z.enum(["queued", "running", "ready", "failed", "canceled"]),
    callsUsed: z.number().int().min(0).max(1),
    deadlineAt: z.iso.datetime(),
    error: z.string().nullable(),
    request: mediaVisionRequestSchema,
    candidates: z.array(stockMediaCandidateSchema).max(6),
    assessments: z.array(mediaVisionAssessmentSchema).max(6),
  })
  .strict();
export type MediaVisionJob = z.infer<typeof mediaVisionJobSchema>;
