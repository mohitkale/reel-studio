import type { BrandTokens } from "./tokens";

/** Image pan/zoom animations available for a background image. */
export type PanEffect = "ken-burns" | "pan-left" | "pan-right" | "pan-up" | "pan-down";

/**
 * Optional full-bleed background for a scene, independent of the template.
 * An image animates with the chosen `effect`; a video plays muted by default
 * (so it never competes with the voiceover) unless `muted` is set false.
 */
export interface SceneBackground {
  type: "image" | "video";
  url: string;
  /** Image only. */
  effect?: PanEffect;
  /** Video only — defaults to true. */
  muted?: boolean;
}

/** A scene as the video engine consumes it (template + text + emphasis + optional visual). */
export interface ReelScene {
  id: string;
  templateId: string;
  text: string;
  emphasis: string[];
  visual?: string;
  /** Per-scene full-bleed background (image or video), any template. */
  background?: SceneBackground;
  /** Explicit list items for list/checklist templates (overrides text splitting). */
  items?: string[];
}

/** Per-beat frame timing, from a voice take or estimated for silent preview. */
export interface ReelBeat {
  sceneId: string;
  startFrame: number;
  durationFrames: number;
}

/** Props every template component receives. */
export interface TemplateProps {
  scene: ReelScene;
  tokens: BrandTokens;
  /** Length of this scene's sequence, for entrance/exit easing. */
  durationInFrames: number;
}

/**
 * Input props for the root ReelComposition. A type alias (not interface) so it
 * is assignable to Remotion's `Record<string, unknown>` props constraint.
 */
export type ReelProps = {
  scenes: ReelScene[];
  timeline: ReelBeat[];
  audioUrl?: string;
  tokens: BrandTokens;
  /** Optional cover image baked as the reel's opening (thumbnail) frame. */
  coverUrl?: string;
};

export const REEL_WIDTH = 1080;
export const REEL_HEIGHT = 1920;
export const REEL_FPS = 30;

/** How long the cover/thumbnail frame is held at the very start of the reel. */
export const COVER_DURATION_SECONDS = 1.5;

/** Cover hold length in frames for a given fps (0 when no cover). */
export function coverFrames(fps: number, hasCover: boolean): number {
  return hasCover ? Math.round(fps * COVER_DURATION_SECONDS) : 0;
}
