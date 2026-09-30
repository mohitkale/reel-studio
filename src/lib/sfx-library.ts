import type { MotionEvent } from "@/production/motion-events";

/**
 * Bundled SFX starter pack (CC0 / public domain via scripts/generate-sfx.mjs).
 * Cue ids map templates → short one-shots mixed under VO.
 */

export type SfxId = "whoosh" | "soft-hit" | "pop" | "click" | "riser" | "swipe";

export interface SfxClip {
  id: SfxId;
  name: string;
  url: string;
  description: string;
  /** Duration and peak of a 10 ms RMS window measured from the bundled WAV. */
  durationSeconds: number;
  peakOffsetSeconds: number;
}

export const SFX_LIBRARY: SfxClip[] = [
  {
    id: "whoosh",
    durationSeconds: 0.62,
    peakOffsetSeconds: 0.345,
    name: "Whoosh",
    url: "/sfx/whoosh.wav",
    description: "Soft cinematic sweep — transitions and CTAs.",
  },
  {
    id: "soft-hit",
    durationSeconds: 0.42,
    peakOffsetSeconds: 0.005,
    name: "Soft hit",
    url: "/sfx/soft-hit.wav",
    description: "Low impact — hooks and slam captions.",
  },
  {
    id: "pop",
    durationSeconds: 0.22,
    peakOffsetSeconds: 0.005,
    name: "Pop",
    url: "/sfx/pop.wav",
    description: "Bright accent — stats and number reveals.",
  },
  {
    id: "click",
    durationSeconds: 0.054989,
    peakOffsetSeconds: 0.005,
    name: "Click",
    url: "/sfx/click.wav",
    description: "Soft UI tick — list items and subtle beats.",
  },
  {
    id: "riser",
    durationSeconds: 0.95,
    peakOffsetSeconds: 0.935,
    name: "Riser",
    url: "/sfx/riser.wav",
    description: "Rising tone — climax / end-card energy.",
  },
  {
    id: "swipe",
    durationSeconds: 0.38,
    peakOffsetSeconds: 0.185,
    name: "Swipe",
    url: "/sfx/swipe.wav",
    description: "Light transition swipe between scenes.",
  },
];

export function getSfxClip(id: string): SfxClip | undefined {
  return SFX_LIBRARY.find((c) => c.id === id);
}

/** Default cue for a template at scene start (sparse, cinematic). */
export function defaultSfxForTemplate(templateId: string): SfxId | null {
  switch (templateId) {
    case "hf-kinetic-slam":
    case "kinetic":
    case "emoji-punch":
      return "soft-hit";
    case "hf-money-count":
    case "hf-stat":
    case "stat-reveal":
      return "soft-hit";
    case "hf-data-chart":
      return "whoosh";
    case "hf-list":
    case "icon-grid":
      return "swipe";
    case "hf-app-showcase":
    case "lottie":
    case "three":
      return "swipe";
    case "hf-ig-follow":
    case "hf-tt-follow":
    case "hf-logo-outro":
    case "hf-cta":
      return "whoosh";
    case "hf-yt-lower-third":
      return "riser";
    case "hf-quote":
    case "quote-card":
      return "swipe";
    // Openers / statements stay silent — VO carries the beat.
    default:
      return null;
  }
}

export interface SfxCue {
  sceneId: string;
  sfxId: SfxId;
  /** Seconds after scene start within the content timeline (post-cover). */
  offsetSeconds: number;
  /** 0–1 linear gain for this one-shot. */
  volume: number;
  /** Missing source is a legacy/authored cue and is protected on refresh. */
  source?: "automatic" | "manual";
  /** A creator can preserve an automatic cue during refresh. */
  locked?: boolean;
  /** Offset becomes a trim relative to this visual event, after peak alignment. */
  event?: MotionEvent;
}

export interface ScriptSfxState {
  enabled: boolean;
  cues: SfxCue[];
}
