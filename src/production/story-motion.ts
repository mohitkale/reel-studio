/** Frozen geometry shared by the native engines. Animation finishes early for reading. */
export function storyMotionGeometry(
  width: number,
  height: number,
  text = "",
  items: readonly string[] = [],
) {
  const longCopy = Array.from(text).length > 60;
  const longLabels = items.some((item) => Array.from(item).length > 36);
  return {
    headline: longCopy
      ? Math.min(width * 0.042, height * 0.06, 64)
      : Math.min(width * 0.061, height * 0.082, 90),
    label: longLabels
      ? Math.min(width * 0.03, height * 0.045, 42)
      : Math.min(width * 0.042, height * 0.06, 56),
    brand: Math.min(width * 0.035, height * 0.05, 46),
    marker: Math.min(width * 0.13, height * 0.17, 180),
    gap: Math.min(width * 0.032, height * 0.045, 48),
    padding: Math.min(width * 0.032, height * 0.04, 42),
    panelHeight: Math.min(height * 0.34, width * 0.54, 460),
    rowHeight: Math.min(height * 0.18, width * 0.28, 220),
    ring: Math.min(width * 0.6, height * 0.65, 760),
  };
}

/** Bound the supplied wordmark so it cannot consume the headline's reading space.
 * Both engines omit unusable names; they never invent a replacement logo/name.
 */
export function storyBrandName(handle: string): string {
  return handle.trim() && Array.from(handle).length <= 60 ? handle : "";
}

export const STORY_MOTION_TRACKS = {
  "comparison-split": [
    { part: "title", at: 0.1, duration: 0.5, x: 0, y: 20 },
    { part: "label-0", at: 0.2, duration: 0.6, x: -60, y: 0 },
    { part: "label-1", at: 0.4, duration: 0.6, x: 60, y: 0 },
  ],
  "comparison-stack": [
    { part: "title", at: 0.1, duration: 0.5, x: 0, y: 20 },
    { part: "label-0", at: 0.2, duration: 0.6, x: 0, y: 45 },
    { part: "label-1", at: 0.5, duration: 0.6, x: 0, y: 45 },
  ],
  "quiet-divider": [
    { part: "marker", at: 0, duration: 0.7, x: 0, y: 0 },
    { part: "rule", at: 0.1, duration: 0.9, x: 0, y: 0, scaleX: 0 },
    { part: "title", at: 0.2, duration: 0.9, x: 0, y: 12 },
  ],
  "quiet-center": [
    {
      part: "ring",
      at: 0,
      duration: 2.4,
      x: 0,
      y: 0,
      scaleX: 0.92,
      scaleY: 0.92,
    },
    { part: "title", at: 0.2, duration: 1, x: 0, y: 0 },
  ],
  "brand-lockup": [
    { part: "brand", at: 0.06, duration: 0.5, x: 0, y: -24 },
    { part: "title", at: 0.42, duration: 0.6, x: 0, y: 36 },
    { part: "rule", at: 0.65, duration: 0.5, x: 0, y: 0, scaleX: 0 },
  ],
  "brand-frame": [
    { part: "rule", at: 0, duration: 0.6, x: 0, y: 0, scaleY: 0 },
    { part: "title", at: 0.2, duration: 0.6, x: -40, y: 0 },
    { part: "brand", at: 0.6, duration: 0.5, x: 0, y: 16 },
  ],
} as const;
export type StoryMotionRecipeId = keyof typeof STORY_MOTION_TRACKS;
export type StoryMotionTrack = {
  part: string;
  at: number;
  duration: number;
  x: number;
  y: number;
  scaleX?: number;
  scaleY?: number;
};
