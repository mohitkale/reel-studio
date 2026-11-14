import { z } from "zod";
import type { SceneDefinition } from "../types";

export const kineticText: SceneDefinition<Record<string, never>> = {
  id: "kinetic-text",
  templateId: "hf-kinetic-text",
  name: "Kinetic text",
  description: "A punchy line slammed in word by word at the largest size.",
  role: "emphasis",
  recipe: "punch-block",
  schema: z.object({}) as unknown as z.ZodType<Record<string, never>>,
  layout: {
    "9:16": "Words stacked two per line, filling the content region",
    "16:9": "Words stacked two per line, centred in the wide region",
    "1:1": "Words stacked two per line, filling the square region",
  },
  build(_payload, kit) {
    return `
      <div class="sc-kinetic">
        <div class="fx-stack kinetic-stack" style="color:${kit.ink}">${kit.lineStack(
          kit.text.toUpperCase(),
          kit.emphasis.map((e) => e.toUpperCase()),
          9,
          "fx-line",
          2,
        )}</div>
        <div class="fx-rule" style="background:${kit.accent}"></div>
      </div>`;
  },
  sample: {
    headline: "Stop scrolling. Start shipping.",
    narration: "Stop scrolling. Start shipping. One small step beats a plan.",
    emphasis: ["shipping"],
    payload: {},
  },
};
