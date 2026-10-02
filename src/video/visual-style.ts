/**
 * Style + Energy — whole-reel look knobs for lay users.
 * Templates stay the same; these change chrome, motion snappiness, and transitions.
 */

export const STYLE_IDS = [
  "bold-hook",
  "clean-story",
  "teach-me",
  "soft-brand",
] as const;
export type StyleId = (typeof STYLE_IDS)[number];

export const ENERGY_IDS = ["calm", "normal", "high"] as const;
export type EnergyId = (typeof ENERGY_IDS)[number];

export const DEFAULT_STYLE_ID: StyleId = "bold-hook";
export const DEFAULT_ENERGY_ID: EnergyId = "normal";

export interface StyleMeta {
  id: StyleId;
  label: string;
  short: string;
  when: string;
}

export interface EnergyMeta {
  id: EnergyId;
  label: string;
  short: string;
}

export const STYLE_META: StyleMeta[] = [
  {
    id: "bold-hook",
    label: "Bold Hook",
    short: "Big text, strong pops, bright accent hits.",
    when: "Tips, launches, and “stop scrolling” openers.",
  },
  {
    id: "clean-story",
    label: "Clean Story",
    short: "Calmer moves, film-like feel, fewer decorations.",
    when: "Brand stories and a more premium look.",
  },
  {
    id: "teach-me",
    label: "Teach Me",
    short: "Clear lists, stats, and explainer pacing.",
    when: "How-tos, education, and step-by-step videos.",
  },
  {
    id: "soft-brand",
    label: "Soft Brand",
    short: "Softer motion, more breathing room, elegant type.",
    when: "Lifestyle, wellness, and high-trust brands.",
  },
];

export const ENERGY_META: EnergyMeta[] = [
  { id: "calm", label: "Calm", short: "Slower text, gentler cuts." },
  { id: "normal", label: "Normal", short: "Balanced pace for most topics." },
  { id: "high", label: "High", short: "Snappier pops and faster exits." },
];

export type TransitionRecipe = "crossfade" | "blur-slide" | "accent-flash";

export interface StyleChrome {
  /** Hide the top progress bar for this style (unless script forces it). */
  preferHideProgressBar: boolean;
  /** Grain opacity 0–1 (0 skips grain). */
  grainOpacity: number;
  /** Vignette strength 0–1. */
  vignetteStrength: number;
  /** Default transition between scenes. */
  transition: TransitionRecipe;
  /** Transition length in frames at 30fps (scaled by energy). */
  transitionFrames: number;
}

export interface MotionRecipe {
  /** Spring damping (higher = less bounce). */
  damping: number;
  stiffness: number;
  mass: number;
  /** Word stagger in frames. */
  stagger: number;
  /** Exit fade length in frames. */
  exitFrames: number;
  /** Text enter delay scale. */
  startDelayScale: number;
}

const STYLE_CHROME: Record<StyleId, StyleChrome> = {
  "bold-hook": {
    preferHideProgressBar: false,
    grainOpacity: 0.1,
    vignetteStrength: 0.55,
    transition: "accent-flash",
    transitionFrames: 8,
  },
  "clean-story": {
    preferHideProgressBar: true,
    grainOpacity: 0.14,
    vignetteStrength: 0.65,
    transition: "crossfade",
    transitionFrames: 12,
  },
  "teach-me": {
    preferHideProgressBar: false,
    grainOpacity: 0.06,
    vignetteStrength: 0.45,
    transition: "blur-slide",
    transitionFrames: 10,
  },
  "soft-brand": {
    preferHideProgressBar: true,
    grainOpacity: 0.08,
    vignetteStrength: 0.4,
    transition: "crossfade",
    transitionFrames: 14,
  },
};

const BASE_MOTION: Record<StyleId, MotionRecipe> = {
  "bold-hook": {
    damping: 180,
    stiffness: 120,
    mass: 0.6,
    stagger: 2.2,
    exitFrames: 10,
    startDelayScale: 0.85,
  },
  "clean-story": {
    damping: 220,
    stiffness: 80,
    mass: 0.85,
    stagger: 3.2,
    exitFrames: 14,
    startDelayScale: 1.15,
  },
  "teach-me": {
    damping: 200,
    stiffness: 100,
    mass: 0.7,
    stagger: 2.6,
    exitFrames: 11,
    startDelayScale: 1,
  },
  "soft-brand": {
    damping: 240,
    stiffness: 70,
    mass: 0.95,
    stagger: 3.5,
    exitFrames: 16,
    startDelayScale: 1.25,
  },
};

const ENERGY_SCALE: Record<
  EnergyId,
  { stiffness: number; stagger: number; exit: number; transition: number }
> = {
  calm: { stiffness: 0.75, stagger: 1.35, exit: 1.35, transition: 1.35 },
  normal: { stiffness: 1, stagger: 1, exit: 1, transition: 1 },
  high: { stiffness: 1.35, stagger: 0.7, exit: 0.7, transition: 0.7 },
};

export function isStyleId(value: string): value is StyleId {
  return (STYLE_IDS as readonly string[]).includes(value);
}

export function isEnergyId(value: string): value is EnergyId {
  return (ENERGY_IDS as readonly string[]).includes(value);
}

export function normalizeStyleId(value: string | null | undefined): StyleId {
  return value && isStyleId(value) ? value : DEFAULT_STYLE_ID;
}

export function normalizeEnergyId(value: string | null | undefined): EnergyId {
  return value && isEnergyId(value) ? value : DEFAULT_ENERGY_ID;
}

export function getStyleChrome(styleId: StyleId): StyleChrome {
  return STYLE_CHROME[styleId];
}

export function getMotionRecipe(styleId: StyleId, energy: EnergyId): MotionRecipe {
  const base = BASE_MOTION[styleId];
  const scale = ENERGY_SCALE[energy];
  return {
    damping: base.damping,
    stiffness: Math.round(base.stiffness * scale.stiffness),
    mass: base.mass,
    stagger: Math.max(1, +(base.stagger * scale.stagger).toFixed(2)),
    exitFrames: Math.max(6, Math.round(base.exitFrames * scale.exit)),
    startDelayScale: base.startDelayScale,
  };
}

export function getTransitionFrames(
  styleId: StyleId,
  energy: EnergyId,
  fps = 30,
): number {
  const chrome = STYLE_CHROME[styleId];
  const scale = ENERGY_SCALE[energy];
  const at30 = Math.max(4, Math.round(chrome.transitionFrames * scale.transition));
  return Math.max(4, Math.round((at30 / 30) * fps));
}

export interface VisualStyleConfig {
  styleId: StyleId;
  energy: EnergyId;
}

export const DEFAULT_VISUAL_STYLE: VisualStyleConfig = {
  styleId: DEFAULT_STYLE_ID,
  energy: DEFAULT_ENERGY_ID,
};
