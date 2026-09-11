import type { ComponentType } from "react";

import { ProductLaunchScene } from "@/compositions/presets/product-launch";
import { EditorialExplainerScene } from "@/compositions/presets/editorial-explainer";
import { CreatorPunchScene } from "@/compositions/presets/creator-punch";
import { DataStoryScene } from "@/compositions/presets/data-story";
import type { TemplateProps } from "@/compositions/types";
import type { ProductionPresetId } from "@/production/presets";

const PRESET_COMPONENTS: Partial<
  Record<ProductionPresetId, ComponentType<TemplateProps>>
> = {
  "product-launch": ProductLaunchScene,
  "editorial-explainer": EditorialExplainerScene,
  "creator-punch": CreatorPunchScene,
  "data-story": DataStoryScene,
};

export function getPresetSceneComponent(
  presetId: ProductionPresetId | undefined,
): ComponentType<TemplateProps> | undefined {
  return presetId ? PRESET_COMPONENTS[presetId] : undefined;
}
