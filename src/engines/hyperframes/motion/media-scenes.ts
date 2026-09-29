import type { BrandTokens } from "@/compositions/tokens";
import type { ReelScene } from "@/compositions/types";
import { buildCinematicBrandScene } from "@/engines/hyperframes/presets/cinematic-brand";
import { buildProductLaunchScene } from "@/engines/hyperframes/presets/product-launch";
import {
  isMediaMotionRecipe,
  resolveMotionDirection,
} from "@/production/motion";

export function buildMediaMotionScene(args: {
  scene: ReelScene;
  tokens: BrandTokens;
  absoluteStart: number;
  duration: number;
  exitWindow: number;
  transitionClass: string;
}): string | null {
  const { scene } = args;
  const motion = resolveMotionDirection(
    scene.motion,
    scene.text,
    scene.chart,
    Boolean(scene.visual),
    scene.items,
    scene.background,
  );
  if (!motion || !isMediaMotionRecipe(motion.recipeId) || scene.hideText)
    return null;
  const device = motion.recipeId === "media-device";
  const directedScene: ReelScene = {
    ...scene,
    role: device ? "screenshot-demo" : "hero",
    templateId: "hf-opener",
  };
  const html = device
    ? buildProductLaunchScene({
        ...args,
        scene: directedScene,
        motionStiffness: "1",
      })
    : buildCinematicBrandScene({
        ...args,
        scene: directedScene,
        motionStiffness: "1",
      });
  return (
    html
      ?.replace(
        "data-production-preset=",
        `data-motion-recipe="${motion.recipeId}" data-motion-version="${motion.version}" data-production-preset=`,
      )
      .replace(
        'class="clip scene preset-scene',
        `class="clip scene preset-scene ${motion.recipeId}`,
      ) ?? null
  );
}

export const MEDIA_MOTION_STYLES = `
  .media-device .pl-media img { object-fit: contain; background: #080c14; }
`;
