/**
 * Theme contract (roadmap V5). A theme is one file: palette, a bundled font
 * pair, type treatment, corner and stroke, a background treatment, a motion
 * personality, a caption style and a music mood. It knows nothing about scene
 * types, so every scene type can wear every theme. A brand kit overrides the
 * palette and fonts but keeps the rest.
 */
import type { CaptionStyleId } from "@/lib/caption-style";

/** Fonts that ship in the frozen render runtime (all OFL-1.1, see docs/LICENSING.md). */
export type BundledFont =
  "Geist" | "Inter" | "EB Garamond" | "Archivo Black" | "JetBrains Mono";

export type BackgroundTreatment =
  "flat" | "grid" | "paper" | "glow" | "blocks" | "blobs" | "cinema";

export type MotionPersonality =
  "snappy" | "smooth" | "punchy" | "calm" | "bouncy" | "hard" | "slow";

export interface Theme {
  id: string;
  name: string;
  description: string;
  /** Words in a storyboard that point at this theme when `theme` is "auto". */
  keywords: readonly string[];
  palette: {
    background: string;
    backgroundAccent: string;
    foreground: string;
    muted: string;
    accent: string;
    accentSecondary: string;
    accentForeground: string;
  };
  fonts: { heading: BundledFont; body: BundledFont };
  type: {
    /** Heading weight, 400 to 900. */
    weight: 400 | 500 | 600 | 700 | 800 | 900;
    /** Letter spacing in em. */
    tracking: number;
    uppercase: boolean;
  };
  shape: { radius: number; stroke: number };
  background: BackgroundTreatment;
  motion: MotionPersonality;
  captionStyle: CaptionStyleId;
  /** Free-text music vibe the music picker can use. */
  musicMood: string;
}
