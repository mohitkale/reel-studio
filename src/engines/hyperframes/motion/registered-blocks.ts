import type { BrandTokens } from "@/video/tokens";
import type { ReelScene } from "@/video/types";
import { EXTENSION_MOTION_RECIPES } from "@/video/motion-extensions";
import { resolveMotionDirection } from "@/production/motion";
import { quoteMarginBlock } from "./quote-block";

export interface MotionBlockArgs {
  scene: ReelScene;
  tokens: BrandTokens;
  absoluteStart: number;
  duration: number;
  exitWindow: number;
  transitionClass: string;
}
interface MotionBlockRegistration {
  recipe: (typeof EXTENSION_MOTION_RECIPES)[number];
  render(args: MotionBlockArgs): string;
  styles: string;
}
/** Renderer registrations keep new blocks out of the core composition dispatch. */
export const REGISTERED_MOTION_BLOCKS = [
  quoteMarginBlock,
] as const satisfies readonly MotionBlockRegistration[];
export const REGISTERED_MOTION_STYLES = REGISTERED_MOTION_BLOCKS.map(
  (block) => block.styles,
).join("\n");
export function buildRegisteredMotionScene(
  args: MotionBlockArgs,
): string | null {
  const { scene } = args;
  if (scene.hideText) return null;
  const direction = resolveMotionDirection(
    scene.motion,
    scene.text,
    scene.chart,
    Boolean(scene.visual),
    scene.items,
    scene.background,
  );
  const block = REGISTERED_MOTION_BLOCKS.find(
    (block) => block.recipe.id === direction?.recipeId,
  );
  return block ? block.render(args) : null;
}
