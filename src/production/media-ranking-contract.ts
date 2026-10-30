import { z } from "zod";
export const mediaRankScoreSchema = z
  .object({
    relevance: z.number().min(0).max(1),
    crop: z.number().min(0).max(1),
    resolution: z.number().min(0).max(1),
    textSpace: z.number().min(0).max(1),
    consistency: z.number().min(0).max(1),
    duplicate: z.boolean(),
  })
  .strict();
export const rankedMediaSummarySchema = z
  .object({
    providerId: z.string().max(64),
    providerAssetId: z.string().max(2048),
    score: z.number().finite(),
    components: mediaRankScoreSchema,
    reasons: z.array(z.string().max(500)).max(10),
  })
  .strict();
export const mediaSelectionRankingSchema = z
  .object({
    version: z.literal(1),
    method: z.enum(["metadata", "metadata+vision"]),
    query: z.string().max(1000),
    selected: rankedMediaSummarySchema,
    alternatives: z.array(rankedMediaSummarySchema).max(5),
  })
  .strict();
export type MediaSelectionRanking = z.infer<typeof mediaSelectionRankingSchema>;
export const mediaVisionAssessmentSchema = z
  .object({
    candidateId: z.string().min(1).max(2200),
    relevance: z.number().min(0).max(1),
    textSpace: z.number().min(0).max(1),
    styleTags: z.array(z.string().trim().min(1).max(40)).max(8),
    reason: z.string().trim().min(1).max(500),
  })
  .strict();
export type MediaVisionAssessment = z.infer<typeof mediaVisionAssessmentSchema>;
