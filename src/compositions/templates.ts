/**
 * Template metadata (plain, no Remotion imports) so client UI like the scene
 * inspector can list templates without pulling in the heavy video engine. The
 * registry (registry.tsx) binds these ids to their React components.
 */
export interface TemplateMeta {
  id: string;
  name: string;
  description: string;
}

export const TEMPLATES: TemplateMeta[] = [
  {
    id: "kinetic",
    name: "Kinetic typography",
    description: "Words reveal with spring motion; emphasis words pop in accent.",
  },
  {
    id: "lottie",
    name: "Lottie explainer",
    description: "A looping vector animation above a caption.",
  },
  {
    id: "three",
    name: "3D accent",
    description: "A rotating 3D object with a lower-third caption.",
  },
];

export const DEFAULT_TEMPLATE_ID = "kinetic";

export function templateName(id: string): string {
  return TEMPLATES.find((t) => t.id === id)?.name ?? id;
}

/** Normalize any stored id (including the old "placeholder") to a known template. */
export function normalizeTemplateId(id: string): string {
  return TEMPLATES.some((t) => t.id === id) ? id : DEFAULT_TEMPLATE_ID;
}
