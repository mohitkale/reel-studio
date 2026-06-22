import type { ComponentType } from "react";

import type { TemplateProps } from "./types";
import { DEFAULT_TEMPLATE_ID } from "./templates";
import { KineticTypography } from "./templates/kinetic-typography";
import { LottieExplainer } from "./templates/lottie-explainer";
import { ThreeAccent } from "./templates/three-accent";

/**
 * Template registry: maps a templateId to its React component. Adding a new
 * scene template = implement TemplateProps + add one entry here. Unknown ids
 * (including the legacy "placeholder") fall back to the default.
 */
const REGISTRY: Record<string, ComponentType<TemplateProps>> = {
  kinetic: KineticTypography,
  lottie: LottieExplainer,
  three: ThreeAccent,
};

export function getTemplateComponent(
  id: string,
): ComponentType<TemplateProps> {
  return REGISTRY[id] ?? REGISTRY[DEFAULT_TEMPLATE_ID];
}
