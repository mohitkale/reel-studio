import { z } from "zod";

/**
 * AI "director" contract. Mirrors the voice provider factory: the app talks only
 * to this interface; adding an LLM vendor = one new file + a registry entry.
 */

export const AI_PROVIDER_IDS = ["gemini", "openai"] as const;
export type AIProviderId = (typeof AI_PROVIDER_IDS)[number];

// Keep in sync with the template registry ids (src/compositions/templates.ts).
export const PLAN_TEMPLATE_IDS = ["kinetic", "lottie", "three"] as const;

export const aiSceneSchema = z.object({
  text: z.string().min(1),
  templateId: z.enum(PLAN_TEMPLATE_IDS),
  emphasis: z.array(z.string()).default([]),
});

export const scenePlanSchema = z.object({
  projectName: z.string().min(1),
  scriptName: z.string().min(1),
  voiceStyle: z.string().optional(),
  scenes: z.array(aiSceneSchema).min(1).max(12),
});

export type AIScene = z.infer<typeof aiSceneSchema>;
export type ScenePlan = z.infer<typeof scenePlanSchema>;

export interface GeneratePlanInput {
  mode: "idea" | "story";
  /** The one-line idea (mode "idea") or the full text/story (mode "story"). */
  brief: string;
  sceneCount?: number;
  modelId?: string;
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
