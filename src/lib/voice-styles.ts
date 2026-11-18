import type { Pacing } from "./kokoro-chunks";

/**
 * Four ways to read the same voice (roadmap P5), from plain numbers: how fast,
 * how long the pauses are, and a small pitch shift. Nothing is random, so the
 * same text and style always give the same audio. Pitch stays within two
 * semitones so the voice still sounds like itself.
 */
export const VOICE_STYLE_IDS = [
  "calm",
  "energetic",
  "storyteller",
  "news",
] as const;
export type VoiceStyleId = (typeof VOICE_STYLE_IDS)[number];

export interface VoiceStyle {
  id: VoiceStyleId;
  label: string;
  description: string;
  /** Multiplier on the voice speed. */
  speed: number;
  /** Multiplier on every pause. */
  pauses: number;
  /** Pitch shift in semitones, within ±2. */
  pitch: number;
  /** Multiplier on the extra beat before a punchline or a number. */
  emphasis: number;
}

export const VOICE_STYLES: Readonly<Record<VoiceStyleId, VoiceStyle>> = {
  calm: {
    id: "calm",
    label: "Calm",
    description:
      "Slower, longer pauses, a little lower. For wellness and sleep.",
    speed: 0.92,
    pauses: 1.35,
    pitch: -0.5,
    emphasis: 1,
  },
  energetic: {
    id: "energetic",
    label: "Energetic",
    description: "Faster, short pauses, a little higher. For hype and tips.",
    speed: 1.1,
    pauses: 0.7,
    pitch: 0.8,
    emphasis: 0.8,
  },
  storyteller: {
    id: "storyteller",
    label: "Storyteller",
    description: "Unhurried with long beats before the key lines.",
    speed: 0.95,
    pauses: 1.5,
    pitch: -1,
    emphasis: 2,
  },
  news: {
    id: "news",
    label: "News",
    description: "Brisk and even, tight pauses, no drama.",
    speed: 1.05,
    pauses: 0.6,
    pitch: 0,
    emphasis: 0.5,
  },
};

export function isVoiceStyleId(value: unknown): value is VoiceStyleId {
  return (
    typeof value === "string" &&
    (VOICE_STYLE_IDS as readonly string[]).includes(value)
  );
}

/** The pause plan for a style: the default pacing with its pauses scaled. */
export function pacingForStyle(
  style: VoiceStyleId | undefined,
  base: Pacing,
): Pacing {
  if (!style) return base;
  const s = VOICE_STYLES[style];
  return {
    sentence: base.sentence * s.pauses,
    paragraph: base.paragraph * s.pauses,
    emphasis: base.emphasis * s.emphasis,
    firstSentenceSpeed: base.firstSentenceSpeed,
  };
}

/** The speed to ask the model for: the style's speed times the video's own. */
export function styledSpeed(
  style: VoiceStyleId | undefined,
  speed: number | undefined,
): number | undefined {
  if (!style) return speed;
  return (speed ?? 1) * VOICE_STYLES[style].speed;
}

/**
 * Resample ratio for a pitch shift in semitones. Generating at speed / ratio and
 * playing the result back `ratio` times faster raises the pitch by that many
 * semitones and leaves the length unchanged.
 */
export function pitchRatio(style: VoiceStyleId | undefined): number {
  if (!style) return 1;
  return 2 ** (Math.max(-2, Math.min(2, VOICE_STYLES[style].pitch)) / 12);
}
