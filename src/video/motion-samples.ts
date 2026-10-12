import type { ReelScene } from "./types";
import { EXTENSION_MOTION_RECIPES } from "./motion-extensions";
import { motionDirection } from "@/production/motion";

/** Illustrative gallery copy is separate from generated project content. */
export const MOTION_SAMPLE_CONTENT: Record<
  (typeof EXTENSION_MOTION_RECIPES)[number]["id"],
  Partial<ReelScene> & { text: string }
> = {
  "quote-margin": {
    text: "Good design gives a useful idea room to breathe.",
    role: "quote",
  },
  "type-spread": {
    text: "Less noise. More room for a clear idea.",
    emphasis: ["clear idea"],
    role: "explanation",
  },
  "type-poster": { text: "Make your next move count.", role: "hook" },
  "type-window": {
    text: "Bring the important part into focus.",
    emphasis: ["focus"],
    role: "headline",
  },
  "list-cascade": {
    text: "Give each step its moment.",
    items: ["Find the idea", "Shape the story", "Share the result"],
    role: "tip",
  },
  "list-grid": {
    text: "A considered creative toolkit.",
    items: [
      "Clear copy",
      "Useful structure",
      "Deliberate motion",
      "Reading space",
    ],
    role: "feature",
  },
  "data-ledger": {
    text: "Three supplied results.",
    role: "chart",
    chart: {
      labels: ["Draft", "Review", "Release"],
      series: [
        { label: "Illustrative values", values: [42, 68, 91], unit: "%" },
      ],
      sourceAttribution: "Demo data · illustrative only",
    },
  },
  "media-mat": {
    text: "Let the image tell its part.",
    role: "hero",
    background: { type: "image", url: "/previews/gallery-study.svg" },
  },
};
export const MOTION_SAMPLES = EXTENSION_MOTION_RECIPES.map(
  (recipe, order): ReelScene => ({
    id: `sample-${recipe.id}`,
    templateId: "hf-statement",
    emphasis: [],
    order,
    ...MOTION_SAMPLE_CONTENT[recipe.id],
    motion: motionDirection(recipe.id),
  }),
);
