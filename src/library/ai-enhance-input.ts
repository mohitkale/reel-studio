import { z } from "zod";
import { mediaPreferenceSchema } from "@/lib/media-preference";
import { AI_PROVIDER_IDS, SCRIPT_STYLES } from "@/providers/ai/types";

/** Browser, REST and MCP share one bounded generation contract. */
export const aiEnhanceRequestSchema = z.object({
  providerId: z.enum(AI_PROVIDER_IDS),
  modelId: z.string().optional(),
  mode: z.enum(["rewrite", "append", "hook_variants"]),
  brief: z.string().trim().min(3).max(4000),
  sceneCount: z.number().int().min(1).max(20).optional(),
  sceneIds: z.array(z.string().min(1)).max(20).optional(),
  chapterId: z.string().min(1).max(160).optional(),
  chapterTitle: z.string().trim().min(1).max(120).optional(),
  scriptStyle: z.enum(SCRIPT_STYLES).optional(),
  mediaPreference: mediaPreferenceSchema.default("auto"),
});
export type AIEnhanceRequest = z.input<typeof aiEnhanceRequestSchema>;
