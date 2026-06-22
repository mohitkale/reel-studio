/**
 * Template metadata. In M3 this is just identity/description used by the scene
 * inspector and preview. M4 adds a TemplateRegistry mapping these ids to real
 * Remotion components (kinetic typography, Lottie, Three.js, ...).
 */
export interface TemplateMeta {
  id: string;
  name: string;
  description: string;
}

export const TEMPLATES: TemplateMeta[] = [
  {
    id: "placeholder",
    name: "Plain card",
    description:
      "Simple text card. Real motion-design templates arrive in milestone 4.",
  },
];

export function templateName(id: string): string {
  return TEMPLATES.find((t) => t.id === id)?.name ?? id;
}
