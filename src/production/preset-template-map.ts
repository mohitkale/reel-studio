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
      feature: "hf-broll",
      comparison: "hf-quote",
      cta: "hf-logo-outro",
    },
  },
  "editorial-explainer": {
    hyperframes: {
      headline: "hf-opener",
      explanation: "hf-broll",
      diagram: "hf-list",
      quote: "hf-quote",
      summary: "hf-list",
    },
  },
  "creator-punch": {
    hyperframes: {
      hook: "hf-kinetic-slam",
      tip: "hf-broll",
      emphasis: "hf-kinetic-slam",
      payoff: "hf-statement",
      cta: "hf-logo-outro",
    },
  },
  "data-story": {
    hyperframes: {
      metric: "hf-stat",
      chart: "hf-data-chart",
      comparison: "hf-data-chart",
      takeaway: "hf-stat",
    },
  },
  "developer-demo": {
    hyperframes: {
      code: "hf-statement",
      diff: "hf-statement",
      terminal: "hf-statement",
      browser: "hf-app-showcase",
      cta: "hf-logo-outro",
    },
  },
  "cinematic-brand": {
    hyperframes: {
      hero: "hf-app-showcase",
      feature: "hf-broll",
      testimonial: "hf-quote",
      logo: "hf-logo-outro",
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
