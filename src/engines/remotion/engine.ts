import {
  TEMPLATES,
  DEFAULT_TEMPLATE_ID,
  normalizeTemplateId as normalizeRemotionTemplateId,
} from "@/compositions/templates";
import type { VideoEngine } from "@/engines/types";
import {
  VIDEO_ENGINE_DESCRIPTIONS,
  VIDEO_ENGINE_LABELS,
} from "@/engines/types";
import { ORIENTATIONS } from "@/lib/orientation";
import {
  PRODUCTION_SCENE_ROLES,
  type ProductionSceneRole,
} from "@/production/roles";

const roleMap: Record<string, readonly ProductionSceneRole[]> = {
  kinetic: ["hook", "headline", "explanation", "emphasis", "payoff", "cta"],
  lottie: ["explanation", "diagram", "feature", "screenshot-demo"],
  three: ["hook", "hero", "feature"],
  "stat-reveal": ["metric", "chart", "comparison", "takeaway"],
  "icon-grid": ["feature", "tip", "comparison", "summary"],
  "quote-card": ["quote", "testimonial"],
  "emoji-punch": ["hook", "emphasis", "payoff", "cta"],
};

const effectMap: Record<string, readonly string[]> = {
  kinetic: ["spring-words", "emphasis-pop"],
  lottie: ["lottie-loop", "marker-highlight"],
  three: ["three-rotation", "wireframe"],
  "stat-reveal": ["metric-slam", "count-up"],
  "icon-grid": ["staggered-list", "icon-badges"],
  "quote-card": ["quote-frame", "serif-reveal"],
  "emoji-punch": ["shockwave", "emoji-slam"],
};

const remotionTemplateCapabilities = Object.fromEntries(
  TEMPLATES.map((template) => [
    template.id,
    {
      templateId: template.id,
      version: "legacy-v0.3.0",
      aspectRatios: ORIENTATIONS,
      sceneRoles: roleMap[template.id] ?? ["explanation"],
      requiredInputs: ["displayText"] as const,
      effects: effectMap[template.id] ?? [],
    },
  ]),
);

/** Remotion adapter — wraps the existing template catalog and composition stack. */
export const remotionEngine: VideoEngine = {
  id: "remotion",
  label: VIDEO_ENGINE_LABELS.remotion,
  description: VIDEO_ENGINE_DESCRIPTIONS.remotion,
  defaultTemplateId: DEFAULT_TEMPLATE_ID,
  capabilities: {
    aspectRatios: ORIENTATIONS,
    sceneRoles: PRODUCTION_SCENE_ROLES,
    templates: remotionTemplateCapabilities,
  },
  listTemplates: () => TEMPLATES,
  normalizeTemplateId: normalizeRemotionTemplateId,
};
