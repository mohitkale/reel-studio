/**
 * Template metadata (plain, no Remotion imports) so client UI like the scene
 * inspector can list templates without pulling in the heavy video engine. The
 * registry (registry.tsx) binds these ids to their React components.
 */
export interface TemplateMeta {
  id: string;
  name: string;
  description: string;
  /** Short label for the visual slot, e.g. "Key stat (73%)" */
  visualHint?: string;
  /** Sample scene for gallery preview */
  sampleText: string;
  sampleEmphasis: string[];
  sampleVisual?: string;
}

export const TEMPLATES: TemplateMeta[] = [
  {
    id: "kinetic",
    name: "Kinetic typography",
    description: "Words reveal with spring motion; emphasis words pop in accent.",
    sampleText: "Stop scrolling. This is how to get unstuck.",
    sampleEmphasis: ["get unstuck"],
  },
  {
    id: "lottie",
    name: "Lottie explainer",
    description: "A looping vector animation above a marker-highlighted caption.",
    sampleText: "Break your ask into one clear, focused message.",
    sampleEmphasis: ["one clear"],
  },
  {
    id: "three",
    name: "3D accent",
    description: "A rotating 3D object with a lower-third caption. High impact.",
    sampleText: "Small, clear asks beat one giant prompt every time.",
    sampleEmphasis: ["Small, clear asks"],
  },
  {
    id: "stat-reveal",
    name: "Stat reveal",
    description: "A big number or metric slams in, then the context reveals below.",
    visualHint: "Key stat or number (e.g. 73% or 10x)",
    sampleText: "Teams using AI ship ten times faster than those who don't.",
    sampleEmphasis: ["ten times faster"],
    sampleVisual: "10x",
  },
  {
    id: "icon-grid",
    name: "Icon checklist",
    description: "Each line of text becomes a bullet item with an icon badge.",
    visualHint: "Bullet emoji (e.g. ✓ or →)",
    sampleText: "Write the goal\nPick the right context\nTest the output",
    sampleEmphasis: [],
    sampleVisual: "✓",
  },
  {
    id: "quote-card",
    name: "Quote card",
    description: "Large decorative quote marks frame the text; attribution below.",
    visualHint: "Author or attribution (optional)",
    sampleText: "The best prompt is the one you actually use.",
    sampleEmphasis: ["the one you actually use"],
    sampleVisual: "AI Weekly",
  },
  {
    id: "emoji-punch",
    name: "Emoji punch",
    description: "A giant emoji slams in with a shockwave, then the one-liner reveals.",
    visualHint: "A single emoji (e.g. 🔥 or ⚡)",
    sampleText: "One habit that changes everything.",
    sampleEmphasis: ["changes everything"],
    sampleVisual: "🔥",
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
