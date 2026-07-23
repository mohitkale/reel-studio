import { z } from "zod";

import type { Orientation } from "@/lib/orientation";
import type { VideoEngineId } from "@/engines/types";
import type { EnergyId, StyleId } from "@/compositions/visual-style";
import { stripMarkdown } from "@/lib/strip-markdown";
import type {
  GeneratePodcastPlanInput,
  PodcastPlan,
} from "./podcast-types";

/**
 * AI "director" contract. Mirrors the voice provider factory: the app talks only
 * to this interface; adding an LLM vendor = one new file + a registry entry.
 */

// Pan/zoom motion the director can request for a scene's photo background.
// Kept in sync with PanEffect (src/compositions/types.ts) / panEffectSchema.
export const planEffectSchema = z.enum([
  "ken-burns",
  "pan-left",
  "pan-right",
  "pan-up",
  "pan-down",
]);

export const AI_PROVIDER_IDS = ["gemini", "openai"] as const;
export type AIProviderId = (typeof AI_PROVIDER_IDS)[number];

/** Short = punchy/fast (today's default). Detailed = deeper narration + story structure. */
export const SCRIPT_STYLES = ["short", "detailed"] as const;
export type ScriptStyle = (typeof SCRIPT_STYLES)[number];

// Broad emotional/visual mood, mirrored from src/library/schemas.ts (kept here
// too so the AI provider layer has no dependency on the DB schema module).
export const sceneMoodSchema = z.enum([
  "energetic",
  "calm",
  "dramatic",
  "playful",
  "inspiring",
  "tech",
  "nature",
]);
export type SceneMood = z.infer<typeof sceneMoodSchema>;

// Remotion + HyperFrames template ids. AI providers still emit Remotion ids
// (smaller schema); HyperFrames projects remap via mapScenesToEngineTemplates.
export const PLAN_TEMPLATE_IDS = [
  "kinetic",
  "lottie",
  "three",
  "stat-reveal",
  "icon-grid",
  "quote-card",
  "emoji-punch",
  "hf-opener",
  "hf-statement",
  "hf-list",
  "hf-stat",
  "hf-quote",
  "hf-cta",
] as const;

export const aiSceneSchema = z.object({
  text: z.string().min(1),
  /**
   * Longer voiceover when scriptStyle is "detailed". Omit/empty for short style
   * (voice uses `text`). When set, should be ~2–3× the on-screen `text`.
   */
  spokenText: z.string().optional(),
  templateId: z.enum(PLAN_TEMPLATE_IDS),
  emphasis: z.array(z.string()).default([]),
  /**
   * Short visual slot (stat, emoji, CTA label). Models sometimes overshoot —
   * truncate instead of failing the whole plan (same leniency as effect/mood).
   */
  visual: z
    .string()
    .optional()
    .transform((v) => {
      if (v == null) return undefined;
      const trimmed = v.trim().slice(0, 64);
      return trimmed.length ? trimmed : undefined;
    }),
  /** Short checklist rows for icon-grid (2–5 items, ~8 words each). */
  items: z.array(z.string().trim().min(1).max(80)).max(5).optional(),
  /** 2-4 concrete visual keywords for a stock photo background, when one fits. */
  backgroundQuery: z.string().trim().min(2).max(80).optional(),
  /**
   * Pan/zoom motion for the background image. Sent to the model as a free string
   * (keeps Gemini's schema small); anything not a known pan effect normalizes to
   * undefined so an invalid value never breaks the plan or persists a bad enum.
   */
  effect: planEffectSchema.optional().catch(undefined),
  /**
   * Emotional/visual tone for scenes with no photo background — drives which
   * dynamic background treatment (Aurora, Particles, Grid Pulse, ...) is used.
   * Sent as a free string and coerced/dropped rather than rejected, same
   * leniency pattern as `effect` above.
   */
  mood: sceneMoodSchema.optional().catch(undefined),
  /** Free-text music vibe (e.g. "uplifting lo-fi", "tense cinematic") for auto music suggestions. */
  musicMood: z.string().trim().max(60).optional(),
});

function sanitizeAiScene(scene: z.infer<typeof aiSceneSchema>): AIScene {
  const text = stripMarkdown(scene.text);
  const spokenRaw = scene.spokenText
    ? stripMarkdown(scene.spokenText).trim()
    : "";
  // Drop spokenText when empty or identical to on-screen text (inherit).
  const spokenText =
    spokenRaw && spokenRaw !== text.trim() ? spokenRaw : undefined;
  const emphasis = scene.emphasis
    .map(stripMarkdown)
    .filter((phrase) => {
      if (!phrase.length) return false;
      // Highlights can appear in on-screen or spoken copy.
      return text.includes(phrase) || (spokenText?.includes(phrase) ?? false);
    });
  const items = scene.items
    ?.map(stripMarkdown)
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 5);
  return {
    ...scene,
    text,
    spokenText,
    emphasis,
    items: items && items.length >= 2 ? items : undefined,
    visual: scene.visual ? stripMarkdown(scene.visual) : undefined,
    backgroundQuery: scene.backgroundQuery
      ? stripMarkdown(scene.backgroundQuery)
      : undefined,
    musicMood: scene.musicMood ? stripMarkdown(scene.musicMood) : undefined,
  };
}

export const planStyleIdSchema = z.enum([
  "bold-hook",
  "clean-story",
  "teach-me",
  "soft-brand",
]);
export const planEnergySchema = z.enum(["calm", "normal", "high"]);

export const scenePlanSchema = z
  .object({
    projectName: z.string().min(1),
    scriptName: z.string().min(1),
    voiceStyle: z.string().optional(),
    /** Whole-reel look family. Optional — UI override or enrichment fills it. */
    styleId: planStyleIdSchema.optional().catch(undefined),
    /** Cut / text snappiness. Optional — UI override or enrichment fills it. */
    energy: planEnergySchema.optional().catch(undefined),
    scenes: z.array(aiSceneSchema).min(1).max(20),
  })
  .transform((plan) => ({
    ...plan,
    projectName: stripMarkdown(plan.projectName),
    scriptName: stripMarkdown(plan.scriptName),
    scenes: plan.scenes.map(sanitizeAiScene),
  }));

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
  /** Target video orientation, so the director frames visuals appropriately. */
  orientation?: Orientation;
  /** Short = same short line on screen + in voice. Detailed = short on-screen text + longer spokenText (~2–3×). Defaults to "short". */
  scriptStyle?: ScriptStyle;
  /** Target video engine; used for prompt/template mapping. Defaults to remotion. */
  videoEngine?: VideoEngineId;
  /**
   * When set (not "auto"), the UI chose Style — the model should still return
   * styleId matching this; enrichment will force it.
   */
  styleId?: StyleId | "auto";
  /** When set (not "auto"), the UI chose Energy — enrichment will force it. */
  energy?: EnergyId | "auto";
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
  generatePodcastPlan(input: GeneratePodcastPlanInput): Promise<PodcastPlan>;
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
