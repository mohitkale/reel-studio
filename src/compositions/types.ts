import type { BrandTokens } from "./tokens";

/** A scene as the video engine consumes it (template + text + emphasis + optional visual). */
export interface ReelScene {
  id: string;
  templateId: string;
  text: string;
  emphasis: string[];
  visual?: string;
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
};

export const REEL_WIDTH = 1080;
export const REEL_HEIGHT = 1920;
export const REEL_FPS = 30;
