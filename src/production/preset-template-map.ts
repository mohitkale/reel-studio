import type { VideoEngineId } from "@/engines/types";
import type { ProductionPresetId } from "@/production/presets";
import type { ProductionSceneRole } from "@/production/roles";

type PresetTemplateMap = Readonly<
  Partial<
    Record<
      ProductionPresetId,
      Readonly<
        Record<VideoEngineId, Partial<Record<ProductionSceneRole, string>>>
      >
    >
  >
>;

/** Versioned adapter choices used when a preset plan is first materialized. */
export const PRESET_TEMPLATE_MAP: PresetTemplateMap = {
  "product-launch": {
    hyperframes: {
      hook: "hf-kinetic-slam",
      "screenshot-demo": "hf-app-showcase",
      feature: "hf-list",
      comparison: "hf-list",
      cta: "hf-logo-outro",
    },
    remotion: {
      hook: "kinetic",
      "screenshot-demo": "lottie",
      feature: "icon-grid",
      comparison: "icon-grid",
      cta: "emoji-punch",
    },
  },
};

export function getPresetTemplateId(args: {
  presetId: ProductionPresetId;
  engineId: VideoEngineId;
  role: ProductionSceneRole;
}): string | undefined {
  return PRESET_TEMPLATE_MAP[args.presetId]?.[args.engineId][args.role];
}
