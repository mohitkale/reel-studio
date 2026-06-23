import { z } from "zod";

/**
 * AI "director" contract. Mirrors the voice provider factory: the app talks only
 * to this interface; adding an LLM vendor = one new file + a registry entry.
 */

export const AI_PROVIDER_IDS = ["gemini", "openai"] as const;
export type AIProviderId = (typeof AI_PROVIDER_IDS)[number];

// Keep in sync with the template registry ids (src/compositions/templates.ts).
export const PLAN_TEMPLATE_IDS = [
  "kinetic",
  "lottie",
  "three",
  "stat-reveal",
  "icon-grid",
  "quote-card",
  "emoji-punch",
] as const;

export const aiSceneSchema = z.object({
  text: z.string().min(1),
  templateId: z.enum(PLAN_TEMPLATE_IDS),
  emphasis: z.array(z.string()).default([]),
  visual: z.string().max(64).optional(),
});

export const scenePlanSchema = z.object({
  projectName: z.string().min(1),
  scriptName: z.string().min(1),
  voiceStyle: z.string().optional(),
  scenes: z.array(aiSceneSchema).min(1).max(20),
});

export type AIScene = z.infer<typeof aiSceneSchema>;
export type ScenePlan = z.infer<typeof scenePlanSchema>;

export interface GeneratePlanInput {
  mode: "idea" | "story" | "rewrite" | "append";
  /** The one-line idea (mode "idea") or the full text/story (mode "story"). */
  brief: string;
  sceneCount?: number;
  modelId?: string;
  /** For "rewrite"/"append": the existing scenes joined as text, for AI context. */
  existingContext?: string;
  /** For "append": how many scenes already exist, so AI knows its starting position. */
  existingSceneCount?: number;
}

export interface AIModel {
  id: string;
  label: string;
}

export interface AIProvider {
  id: AIProviderId;
  label: string;
  isConfigured(): boolean;
  listModels(): Promise<AIModel[]>;
  generatePlan(input: GeneratePlanInput): Promise<ScenePlan>;
}

export const aiProviderStatusSchema = z.object({
  id: z.enum(AI_PROVIDER_IDS),
  label: z.string(),
  configured: z.boolean(),
  defaultModel: z.string(),
});
export type AIProviderStatus = z.infer<typeof aiProviderStatusSchema>;

export class AIError extends Error {
  constructor(
    message: string,
    readonly status = 502,
    readonly providerId?: AIProviderId,
  ) {
    super(message);
    this.name = "AIError";
  }
}
