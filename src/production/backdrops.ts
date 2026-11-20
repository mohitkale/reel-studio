import type { PanEffect, SceneBackground } from "@/video/types";

/** Scenes that carry a picture of their own. */
const PICTURE_SCENES = new Set([
  "hf-broll",
  "hf-media-split",
  "hf-device-mockup",
]);
/** Text scenes that read well over a darkened photograph. */
const BACKDROP_SCENES = new Set([
  "hf-opener",
  "hf-statement",
  "hf-stat",
  "hf-quote",
  "hf-cta",
  "hf-kinetic-text",
  "hf-definition",
]);
const MOVES: PanEffect[] = ["pan-left", "ken-burns", "pan-right", "pan-up"];
const REACH = 3;

/**
 * A video made of someone's own pictures should not turn to flat panels
 * between them. Text scenes with no picture borrow the nearest supplied one
 * (never a stock photo, whose credit belongs to the scene it was chosen for)
 * as a darkened, slowly moving backdrop, and each borrows with a different move.
 */
export function shareBackdrops(
  templateIds: readonly string[],
  backgrounds: ReadonlyArray<SceneBackground | undefined>,
): Array<SceneBackground | undefined> {
  const suppliedPicture = (index: number): SceneBackground | undefined => {
    const background = backgrounds[index];
    return PICTURE_SCENES.has(templateIds[index] ?? "") &&
      background?.type === "image" &&
      !background.stock
      ? background
      : undefined;
  };
  let borrowed = 0;
  return backgrounds.map((background, index) => {
    if (background || !BACKDROP_SCENES.has(templateIds[index] ?? ""))
      return background;
    for (let distance = 1; distance <= REACH; distance++) {
      const source =
        suppliedPicture(index - distance) ?? suppliedPicture(index + distance);
      if (source) {
        return {
          type: "image" as const,
          url: source.url,
          effect: MOVES[borrowed++ % MOVES.length]!,
        };
      }
    }
    return undefined;
  });
}
