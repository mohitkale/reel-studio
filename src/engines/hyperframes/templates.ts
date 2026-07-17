/**
 * HyperFrames-native professional template catalog.
 * Distinct look/motion from Remotion templates — HTML + CSS + GSAP strengths.
 */

import type { EngineTemplateMeta } from "@/engines/types";

export const HF_TEMPLATES: EngineTemplateMeta[] = [
  {
    id: "hf-opener",
    name: "Cold open",
    description:
      "Full-bleed kinetic opener with a sharp accent bar and staggered word reveal.",
    sampleText: "Stop scrolling. This is the part that matters.",
    sampleEmphasis: ["matters"],
  },
  {
    id: "hf-statement",
    name: "Bold statement",
    description:
      "Centered editorial line with a soft gradient wash and emphasis underline.",
    sampleText: "Clarity beats cleverness every single time.",
    sampleEmphasis: ["Clarity"],
  },
  {
    id: "hf-list",
    name: "Paced list",
    description:
      "Numbered vertical stack that ticks in one beat at a time.",
    visualHint: "Bullet or number marker (optional)",
    sampleText: "Write the goal\nPick the right context\nShip the draft",
    sampleEmphasis: [],
    sampleVisual: "→",
  },
  {
    id: "hf-stat",
    name: "Proof number",
    description:
      "Oversized metric slam with a clean supporting line underneath.",
    visualHint: "Key stat or number (e.g. 73% or 10x)",
    sampleText: "Teams that ship weekly grow twice as fast.",
    sampleEmphasis: ["twice as fast"],
    sampleVisual: "2×",
  },
  {
    id: "hf-quote",
    name: "Pull quote",
    description:
      "Wide quote marks, serif emphasis, and a quiet attribution footer.",
    visualHint: "Author or attribution (optional)",
    sampleText: "The best prompt is the one you actually use.",
    sampleEmphasis: ["actually use"],
    sampleVisual: "AI Weekly",
  },
  {
    id: "hf-cta",
    name: "End card",
    description:
      "Closing CTA with brand handle strip and a confident hold frame.",
    visualHint: "CTA label (e.g. Follow for more)",
    sampleText: "Follow for the next breakdown.",
    sampleEmphasis: ["Follow"],
    sampleVisual: "Subscribe",
  },
];

export const HF_DEFAULT_TEMPLATE_ID = "hf-opener";

export const HF_TEMPLATE_IDS = HF_TEMPLATES.map((t) => t.id) as [
  string,
  ...string[],
];

export function normalizeHfTemplateId(id: string): string {
  return HF_TEMPLATES.some((t) => t.id === id) ? id : HF_DEFAULT_TEMPLATE_ID;
}
