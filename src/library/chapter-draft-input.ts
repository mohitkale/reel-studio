import { z } from "zod";
import { chapterDraftSchema } from "@/production/chapter-draft";
import { mediaPreferenceSchema } from "@/lib/media-preference";
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

/** Each explicit request authorizes exactly one bounded chapter invocation. */
export const chapterGenerationRequestSchema = z
  .object({
    providerId: z.enum(AI_PROVIDER_IDS),
    modelId: z.string().optional(),
    expected: chapterDraftSchema,
    chapterId: z.string().min(1).max(160),
    maxProviderCalls: z.literal(1),
    mediaPreference: mediaPreferenceSchema.default("none"),
  })
  .strict();
export type ChapterGenerationRequest = z.infer<
  typeof chapterGenerationRequestSchema
>;
