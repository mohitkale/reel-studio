import type { AIScene, SceneMood, ScenePlan } from "@/providers/ai/types";
import type { VideoEngineId } from "@/engines/types";
import {
  DEFAULT_ENERGY_ID,
  DEFAULT_STYLE_ID,
  normalizeEnergyId,
  normalizeStyleId,
  type EnergyId,
  type StyleId,
} from "@/compositions/visual-style";
import { mapScenesToEngineTemplates } from "@/engines/hyperframes/map-templates";

const MOODS: SceneMood[] = [
  "energetic",
  "calm",
  "dramatic",
  "playful",
  "inspiring",
  "tech",
  "nature",
];

/** Templates that read best with mood-driven animation, not a stock photo. */
const MOOD_ONLY_TEMPLATES = new Set<string>([
  "emoji-punch",
  "stat-reveal",
  "icon-grid",
  "quote-card",
  "hf-stat",
  "hf-list",
  "hf-quote",
  "hf-cta",
]);

/** Default mood when the model omits one — biased by template so beats feel intentional. */
const TEMPLATE_MOOD: Partial<Record<string, SceneMood>> = {
  "emoji-punch": "playful",
  "stat-reveal": "dramatic",
  "icon-grid": "tech",
  "quote-card": "inspiring",
  lottie: "calm",
  three: "inspiring",
  kinetic: "energetic",
  "hf-opener": "dramatic",
  "hf-statement": "energetic",
  "hf-list": "tech",
  "hf-stat": "dramatic",
  "hf-quote": "inspiring",
  "hf-cta": "inspiring",
};

/** Rotating stock-photo queries per mood when the model leaves backgroundQuery empty. */
const MOOD_STOCK_QUERIES: Record<SceneMood, string[]> = {
  dramatic: ["stormy dark sky", "moody cinematic city", "dramatic mountain clouds"],
  energetic: ["dynamic motion blur", "bright urban energy", "sunrise action"],
  calm: ["soft morning light", "peaceful nature lake", "minimal calm workspace"],
  playful: ["colorful abstract fun", "bright playful pattern", "whimsical pastel"],
  inspiring: ["golden hour horizon", "mountain sunrise vista", "open road journey"],
  tech: ["modern technology abstract", "futuristic digital grid", "sleek office glass"],
  nature: ["green forest sunlight", "ocean waves nature", "mountain meadow landscape"],
};

const STOP_WORDS = new Set([
  "about",
  "after",
  "again",
  "all",
  "also",
  "and",
  "are",
  "back",
  "but",
  "can",
  "come",
  "could",
  "did",
  "different",
  "for",
  "from",
  "had",
  "has",
  "have",
  "here",
  "his",
  "house",
  "how",
  "just",
  "like",
  "literally",
  "little",
  "more",
  "most",
  "not",
  "one",
  "out",
  "same",
  "that",
  "the",
  "their",
  "then",
  "there",
  "they",
  "this",
  "think",
  "time",
  "was",
  "were",
  "what",
  "when",
  "with",
  "wolf",
  "you",
  "your",
]);

const PAN_EFFECTS: NonNullable<AIScene["effect"]>[] = [
  "ken-burns",
  "pan-left",
  "pan-right",
  "pan-up",
  "pan-down",
];

/** Pull 2–4 concrete, photographable keywords from scene copy. */
function keywordsFromText(text: string): string | undefined {
  const words = text
    .replace(/[^\w\s]/g, " ")
    .split(/\s+/)
    .map((w) => w.trim())
    .filter((w) => w.length > 3 && !STOP_WORDS.has(w.toLowerCase()));

  const unique = [...new Set(words.map((w) => w.toLowerCase()))];
  if (unique.length >= 2) {
    return unique
      .slice(0, 4)
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(" ");
  }
  return undefined;
}

export function inferSceneMood(
  templateId: string,
  order: number,
): SceneMood {
  const mood = TEMPLATE_MOOD[templateId];
  return mood ?? MOODS[((order % MOODS.length) + MOODS.length) % MOODS.length];
}

function defaultMood(scene: AIScene, index: number): SceneMood {
  return inferSceneMood(scene.templateId, index);
}

function defaultBackgroundQuery(scene: AIScene, mood: SceneMood, index: number): string {
  return (
    keywordsFromText(scene.text) ??
    MOOD_STOCK_QUERIES[mood][index % MOOD_STOCK_QUERIES[mood].length]
  );
}

function wordCount(s: string): number {
  return s.trim().split(/\s+/).filter(Boolean).length;
}

function parseListItems(text: string): string[] {
  return text
    .split(/\n|•|;/)
    .map((s) => s.replace(/^[-*–]\s*/, "").trim())
    .filter(Boolean);
}

/**
 * Checklist templates need 2–5 short rows. One long paragraph as a "checklist"
 * looks broken — demote to kinetic / hf-statement instead.
 */
export function repairChecklistScene(scene: AIScene): AIScene {
  const isList =
    scene.templateId === "icon-grid" || scene.templateId === "hf-list";
  if (!isList) return scene;

  const items = (scene.items?.length ? scene.items : parseListItems(scene.text))
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 5);

  const valid =
    items.length >= 2 &&
    items.length <= 5 &&
    items.every((item) => wordCount(item) <= 12);

  if (!valid) {
    return {
      ...scene,
      templateId: scene.templateId === "hf-list" ? "hf-statement" : "kinetic",
      items: undefined,
      visual: scene.templateId === "icon-grid" ? undefined : scene.visual,
    };
  }

  // Keep spoken `text` for voiceover. Prefer explicit items; otherwise persist
  // the short rows we parsed so the template doesn't re-split a paragraph.
  return {
    ...scene,
    items,
    visual: scene.visual?.trim() || "✓",
  };
}

/**
 * Fill gaps the model often leaves: every scene gets a mood, a stock-photo
 * query, and a pan effect so AI generation never lands on a plain empty gradient.
 * Safe to run on every plan before resolveSceneBackgrounds().
 * When `videoEngine` is hyperframes, Remotion template ids are remapped first.
 */
export function enrichScenePlan(
  scenes: AIScene[],
  videoEngine: VideoEngineId = "remotion",
): AIScene[] {
  const mapped = mapScenesToEngineTemplates(scenes, videoEngine).map(
    repairChecklistScene,
  );
  return mapped.map((scene, index) => {
    // Prefer calmer moods for text-heavy beats so the eye can rest.
    const moodBias =
      scene.templateId === "kinetic" ||
      scene.templateId === "hf-statement" ||
      scene.templateId === "quote-card" ||
      scene.templateId === "hf-quote"
        ? ("calm" as SceneMood)
        : undefined;
    const mood = scene.mood ?? moodBias ?? defaultMood(scene, index);
    const wantsPhoto =
      Boolean(scene.backgroundQuery?.trim()) ||
      !MOOD_ONLY_TEMPLATES.has(scene.templateId);
    const backgroundQuery = wantsPhoto
      ? scene.backgroundQuery?.trim() || defaultBackgroundQuery(scene, mood, index)
      : undefined;
    const effect =
      scene.effect ?? PAN_EFFECTS[index % PAN_EFFECTS.length];

    return {
      ...scene,
      mood,
      backgroundQuery,
      effect,
    };
  });
}

/** Resolve Style + Energy from UI locks and/or the model plan. */
export function resolvePlanVisualStyle(
  plan: Pick<ScenePlan, "styleId" | "energy">,
  locks?: { styleId?: StyleId | "auto"; energy?: EnergyId | "auto" },
): { styleId: StyleId; energy: EnergyId } {
  const styleId =
    locks?.styleId && locks.styleId !== "auto"
      ? normalizeStyleId(locks.styleId)
      : normalizeStyleId(plan.styleId ?? DEFAULT_STYLE_ID);
  const energy =
    locks?.energy && locks.energy !== "auto"
      ? normalizeEnergyId(locks.energy)
      : normalizeEnergyId(plan.energy ?? DEFAULT_ENERGY_ID);
  return { styleId, energy };
}
