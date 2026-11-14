/**
 * Variety engine (roadmap V11): a seeded director that gives every video its
 * own look inside a theme, with no model and no randomness that cannot be
 * reproduced. The same storyboard and seed always resolve to the same plan.
 *
 * It chooses, per scene, a layout variant, a motion variant and a camera move
 * from the scene's content, its place in the video, what the previous scenes
 * used, the theme's motion personality and the video's seed; and per video an
 * accent rotation and a background treatment from the theme's allowed set.
 */
import type {
  BackgroundTreatment,
  MotionPersonality,
} from "@/video/themes/types";

export type VarietyLevel = "low" | "medium" | "high";
/** panel: the outlined card (default). open: a soft colour wash with no outline. band: an accent-edged card, the visual peak. */
export type LayoutVariant = "panel" | "open" | "band";
export type MotionVariant = "rise" | "slide" | "pop" | "drift";
export type CameraMove = "none" | "push-in" | "pull-out" | "pan";

export interface SceneLook {
  layout: LayoutVariant;
  motion: MotionVariant;
  camera: CameraMove;
  /** True for the scenes that carry the video's visual peaks. */
  peak: boolean;
}

export interface LookPlan {
  seed: string;
  variety: VarietyLevel;
  scenes: SceneLook[];
  /** Swap the accent and secondary accent for the whole video. */
  accentRotation: boolean;
  background: BackgroundTreatment;
}

export interface LookSceneInput {
  /** Template id of the scene, for text-only detection. */
  templateId: string;
  seconds: number;
}

/** Scenes that are type on a background and nothing else. */
const TEXT_ONLY = new Set([
  "hf-opener",
  "hf-statement",
  "hf-quote",
  "hf-cta",
  "hf-kinetic-text",
  "hf-definition",
]);

const NON_DEFAULT_CHANCE: Record<VarietyLevel, number> = {
  low: 0.2,
  medium: 0.55,
  high: 0.85,
};
const CAMERA_CHANCE: Record<VarietyLevel, number> = {
  low: 0,
  medium: 0.3,
  high: 0.5,
};

const MOTIONS_BY_PERSONALITY: Record<
  MotionPersonality,
  readonly MotionVariant[]
> = {
  snappy: ["slide", "rise", "pop"],
  smooth: ["rise", "drift", "slide"],
  punchy: ["pop", "slide", "rise"],
  calm: ["drift", "rise", "slide"],
  bouncy: ["pop", "rise", "slide"],
  hard: ["slide", "rise", "pop"],
  slow: ["drift", "rise", "slide"],
};

/** Backgrounds a theme may swap between, always including its own. */
export function allowedBackgrounds(
  own: BackgroundTreatment,
): BackgroundTreatment[] {
  const sets: Partial<Record<BackgroundTreatment, BackgroundTreatment[]>> = {
    grid: ["grid", "glow", "flat"],
    glow: ["glow", "grid", "flat"],
    paper: ["paper", "flat"],
    blocks: ["blocks", "blobs", "flat"],
    blobs: ["blobs", "blocks", "flat"],
    cinema: ["cinema", "glow"],
    flat: ["flat", "paper"],
  };
  return sets[own] ?? [own];
}

/** FNV-1a: a stable 32-bit hash of any string. */
export function hashSeed(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** mulberry32: a small deterministic generator. */
function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pick<T>(random: () => number, list: readonly T[]): T {
  return list[Math.floor(random() * list.length)]!;
}

export function planLook(input: {
  scenes: LookSceneInput[];
  seed: string;
  variety?: VarietyLevel;
  personality: MotionPersonality;
  themeBackground: BackgroundTreatment;
  reduceMotion?: boolean;
}): LookPlan {
  const variety = input.variety ?? "medium";
  const random = rng(hashSeed(`${input.seed}|${variety}|${input.personality}`));
  const chance = NON_DEFAULT_CHANCE[variety];
  const motions = MOTIONS_BY_PERSONALITY[input.personality];
  const scenes: SceneLook[] = [];
  let sinceFifteen = 0;
  let textRun = 0;
  let lastCamera = false;

  for (const [index, scene] of input.scenes.entries()) {
    const previous = scenes[index - 1];
    const textOnly = TEXT_ONLY.has(scene.templateId);
    textRun = textOnly ? textRun + 1 : 0;

    // A visual peak in the first seconds and about every fifteen after that.
    const peak = variety !== "low" && (index === 0 || sinceFifteen >= 15);
    sinceFifteen = peak ? 0 : sinceFifteen + scene.seconds;

    let layout: LayoutVariant = "panel";
    if (peak) layout = "band";
    else if (random() < chance) layout = random() < 0.5 ? "open" : "band";
    // Never the same layout twice in a row, and a third text-only scene in a
    // row is always dressed differently from the two before it.
    if (previous && layout === previous.layout) {
      layout = pick(
        random,
        (["panel", "open", "band"] as const).filter(
          (l) => l !== previous.layout,
        ),
      );
    }
    if (textRun >= 3 && layout === "panel") layout = "open";
    if (previous && layout === previous.layout) layout = "band";

    let motion: MotionVariant = motions[0]!;
    if (random() < chance) motion = pick(random, motions);
    // Never the same entrance twice in a row.
    if (previous && motion === previous.motion) {
      motion = pick(
        random,
        (["rise", "slide", "pop", "drift"] as const).filter(
          (m) => m !== previous.motion,
        ),
      );
    }
    if (input.reduceMotion) motion = "rise";

    let camera: CameraMove = "none";
    if (
      !input.reduceMotion &&
      !lastCamera &&
      (peak || random() < CAMERA_CHANCE[variety])
    ) {
      camera = pick(random, ["push-in", "pull-out", "pan"] as const);
    }
    lastCamera = camera !== "none";
    scenes.push({ layout, motion, camera, peak });
  }

  const backgrounds = allowedBackgrounds(input.themeBackground);
  const background =
    variety === "low" ? input.themeBackground : pick(random, backgrounds);
  return {
    seed: input.seed,
    variety,
    scenes,
    accentRotation: variety !== "low" && random() < 0.5,
    background,
  };
}
