import type { BrandTokens } from "./tokens";

/** Image pan/zoom animations available for a background image. */
export type PanEffect = "ken-burns" | "pan-left" | "pan-right" | "pan-up" | "pan-down";

/**
 * Emotional/visual tone a scene can carry, mirrored from src/library/schemas.ts.
 * Drives which dynamic background treatment is used when a scene has no photo
 * background (see components/background-treatments.tsx).
 */
export type SceneMood =
  | "energetic"
  | "calm"
  | "dramatic"
  | "playful"
  | "inspiring"
  | "tech"
  | "nature";

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
  /** When true, suppress the on-screen text/visual and show just the background. */
  hideText?: boolean;
  /** Emotional/visual tone; picks the dynamic background treatment when there's no photo/video background. */
  mood?: SceneMood;
  /** This scene's position in the reel, used to deterministically vary the background treatment when no mood is set. */
  order?: number;
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
  /** Optional background music track, mixed under the voiceover. */
  musicUrl?: string;
  /** Background music level, 0-100. */
  musicVolume?: number;
  tokens: BrandTokens;
  /** Optional cover image baked as the reel's opening (thumbnail) frame. */
  coverUrl?: string;
  /** Render canvas size (orientation). Falls back to REEL_WIDTH/HEIGHT. */
  width?: number;
  height?: number;
  fps?: number;
  /** When true, suppress the top progress bar on every scene. */
  hideProgressBar?: boolean;
  /**
   * Editor-only preview fidelity switch: "draft" trims expensive effects
   * (background blur, grain, 3D particle count/DPR) for smoother scrubbing.
   * Renders always use "standard" (the default).
   */
  previewQuality?: "standard" | "draft";
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
