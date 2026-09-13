import { z } from "zod";

/** Engine-independent scene purposes used by production presets and adapters. */
export const PRODUCTION_SCENE_ROLES = [
  "hook",
  "screenshot-demo",
  "feature",
  "comparison",
  "cta",
  "headline",
  "explanation",
  "diagram",
  "quote",
  "summary",
  "tip",
  "emphasis",
  "payoff",
  "metric",
  "chart",
  "takeaway",
  "code",
  "diff",
  "terminal",
  "browser",
  "hero",
  "testimonial",
  "logo",
] as const;

export const productionSceneRoleSchema = z.enum(PRODUCTION_SCENE_ROLES);
export type ProductionSceneRole = z.infer<typeof productionSceneRoleSchema>;
