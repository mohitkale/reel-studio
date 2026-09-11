import type { BrandTokens } from "@/compositions/tokens";
import type { ReelScene } from "@/compositions/types";
import {
  buildProductLaunchScene,
  PRODUCT_LAUNCH_STYLES,
} from "@/engines/hyperframes/presets/product-launch";
import {
  buildEditorialExplainerScene,
  EDITORIAL_EXPLAINER_STYLES,
} from "@/engines/hyperframes/presets/editorial-explainer";
import type { ProductionPresetId } from "@/production/presets";

export interface HyperframesPresetSceneArgs {
  scene: ReelScene;
  tokens: BrandTokens;
  absoluteStart: number;
  duration: number;
  exitWindow: number;
  transitionClass: string;
  motionStiffness: string;
}

const BUILDERS: Partial<
  Record<
    ProductionPresetId,
    (args: HyperframesPresetSceneArgs) => string | null
  >
> = {
  "product-launch": buildProductLaunchScene,
  "editorial-explainer": buildEditorialExplainerScene,
};

export function buildHyperframesPresetScene(
  presetId: ProductionPresetId,
  args: HyperframesPresetSceneArgs,
): string | null {
  return BUILDERS[presetId]?.(args) ?? null;
}

export const HYPERFRAMES_PRESET_STYLES = `${PRODUCT_LAUNCH_STYLES}${EDITORIAL_EXPLAINER_STYLES}`;
