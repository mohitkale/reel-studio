import type { VideoEngine } from "@/engines/types";
import {
  VIDEO_ENGINE_DESCRIPTIONS,
  VIDEO_ENGINE_LABELS,
} from "@/engines/types";
import {
  HF_DEFAULT_TEMPLATE_ID,
  HF_TEMPLATES,
  normalizeHfTemplateId,
} from "@/engines/hyperframes/templates";
import { ORIENTATIONS } from "@/lib/orientation";
import {
  PRODUCTION_SCENE_ROLES,
  type ProductionSceneRole,
} from "@/production/roles";

function rolesForTemplate(templateId: string): readonly ProductionSceneRole[] {
  if (/logo/.test(templateId)) return ["logo", "cta"];
  if (/cta|follow|lower-third/.test(templateId)) return ["cta"];
  if (/data-chart/.test(templateId)) return ["chart", "comparison"];
  if (/stat|money-count/.test(templateId)) return ["metric", "takeaway"];
  if (/quote/.test(templateId)) return ["quote", "testimonial"];
  if (/app-showcase/.test(templateId))
    return ["screenshot-demo", "feature", "hero"];
  if (/list/.test(templateId)) return ["tip", "feature", "summary"];
  if (/opener|kinetic/.test(templateId))
    return ["hook", "headline", "emphasis"];
  return ["explanation", "feature", "payoff"];
}

function requiredInputsForTemplate(templateId: string) {
  if (templateId === "hf-data-chart")
    return ["displayText", "chartData"] as const;
  if (templateId === "hf-app-showcase")
    return ["displayText", "asset"] as const;
  return ["displayText"] as const;
}

function effectsForTemplate(templateId: string): readonly string[] {
  if (/kinetic/.test(templateId)) return ["gsap-word-slam", "beat-accents"];
  if (/data-chart/.test(templateId)) return ["chart-reveal", "line-draw"];
  if (/app-showcase/.test(templateId))
    return ["device-stage", "floating-cards"];
  if (/money-count|stat/.test(templateId)) return ["count-up", "metric-slam"];
  if (/logo/.test(templateId)) return ["logo-assembly", "texture"];
  if (/follow|lower-third/.test(templateId))
    return ["social-overlay", "cta-pop"];
  return ["gsap-timeline", "scene-transition"];
}

const hyperframesTemplateCapabilities = Object.fromEntries(
  HF_TEMPLATES.map((template) => [
    template.id,
    {
      templateId: template.id,
      version: "legacy-v0.3.0",
      aspectRatios: ORIENTATIONS,
      sceneRoles: rolesForTemplate(template.id),
      requiredInputs: requiredInputsForTemplate(template.id),
      effects: effectsForTemplate(template.id),
    },
  ]),
);

/** HyperFrames adapter — HTML-native templates and (later) player/render. */
export const hyperframesEngine: VideoEngine = {
  id: "hyperframes",
  label: VIDEO_ENGINE_LABELS.hyperframes,
  description: VIDEO_ENGINE_DESCRIPTIONS.hyperframes,
  defaultTemplateId: HF_DEFAULT_TEMPLATE_ID,
  capabilities: {
    aspectRatios: ORIENTATIONS,
    sceneRoles: PRODUCTION_SCENE_ROLES,
    templates: hyperframesTemplateCapabilities,
  },
  listTemplates: () => HF_TEMPLATES,
  normalizeTemplateId: normalizeHfTemplateId,
};
