import type { ReelScene } from "./types";
import { ADAPTIVE_RECIPES, type AdaptiveRecipeId } from "./adaptive-catalog";
export const ADAPTIVE_SAMPLE_CONTENT: Record<
  AdaptiveRecipeId,
  Partial<ReelScene> & { text: string }
> = {
  "adaptive-concept": {
    text: "A clear idea earns its space.",
    role: "explanation",
  },
  "adaptive-comparison": {
    text: "Choose how the story unfolds.",
    role: "comparison",
    items: [
      "A focused overview",
      "A guided explanation",
      "A detailed reference",
    ],
  },
  "adaptive-process": {
    text: "From source to a finished film.",
    role: "diagram",
    items: [
      "Gather the source",
      "Shape the scenes",
      "Review the timing",
      "Export the film",
    ],
  },
  "adaptive-evidence": {
    text: "Keep the evidence visible.",
    role: "chart",
    chart: {
      labels: ["Draft", "Review", "Release"],
      series: [
        { label: "Illustrative completion", values: [42, 68, 91], unit: "%" },
      ],
      sourceAttribution: "Synthetic demonstration data",
    },
  },
  "adaptive-media": {
    text: "Give the product room to speak.",
    role: "screenshot-demo",
    background: { type: "image", url: "/adaptive-demo.svg" },
  },
  "adaptive-editorial": {
    text: "A good explanation gives every sentence a purpose. Let the reader see the whole thought before moving to the next one.",
    role: "explanation",
  },
};
export const ADAPTIVE_SAMPLES: ReelScene[] = ADAPTIVE_RECIPES.map((r, i) => ({
  id: r.id,
  templateId: "hf-statement",
  emphasis: [],
  order: i,
  ...ADAPTIVE_SAMPLE_CONTENT[r.id],
  motion: { recipeId: r.id, version: "1.0.0", system: "precision" },
}));
