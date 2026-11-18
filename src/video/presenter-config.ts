/**
 * The presenter a storyboard video asks for (roadmap P1): which character, where
 * it sits, and which scenes turn it off. Plain data shared by the storyboard,
 * the saved project and the renderer.
 */
export const PRESENTER_CHARACTER_IDS = [
  "maya",
  "sam",
  "ada",
  "rex",
  "orb",
  "bolt",
] as const;
export type PresenterCharacterId = (typeof PRESENTER_CHARACTER_IDS)[number];

/** `corner` is a round bubble; `full` is a large host over the lower middle of the frame. */
export const VIDEO_PRESENTER_PLACEMENTS = ["corner", "full"] as const;
export type VideoPresenterPlacement =
  (typeof VIDEO_PRESENTER_PLACEMENTS)[number];

export interface PresenterConfig {
  character: PresenterCharacterId;
  placement: VideoPresenterPlacement;
  /** Scene indexes where the presenter is off (full-bleed scenes). */
  off?: number[];
}
