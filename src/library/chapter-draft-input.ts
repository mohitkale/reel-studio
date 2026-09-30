import { z } from "zod";
import { AI_PROVIDER_IDS } from "@/providers/ai/types";

export const chapterDraftRequestSchema = z
  .object({
    providerId: z.enum(AI_PROVIDER_IDS),
    modelId: z.string().optional(),
    topic: z.string().trim().min(3).max(4000),
    chapterCount: z.number().int().min(1).max(12),
    scenesPerChapter: z.number().int().min(1).max(20),
  })
  .strict();
export type ChapterDraftRequest = z.infer<typeof chapterDraftRequestSchema>;
