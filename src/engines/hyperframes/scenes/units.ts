/**
 * Sizes for scene styles are fractions of the frame height (`--frame-h`), so one
 * rule serves every format. `px(0.036)` is 3.6% of the frame's height, scaled by
 * the engine when it fits the text to the panel.
 */
const H = "var(--frame-h, 1920px)";
export const px = (k: number): string =>
  `calc(${H} * ${k} * var(--sc-scale, 1))`;
