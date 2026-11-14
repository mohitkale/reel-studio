import { z } from "zod";
import type { SceneDefinition } from "../types";
import { point } from "../timeline";

const payload = z.object({ points: z.array(point).min(2).max(5) });
type Payload = z.infer<typeof payload>;

export const diagram: SceneDefinition<Payload> = {
  id: "diagram",
  templateId: "hf-diagram",
  name: "Flow diagram",
  description:
    "Connected boxes for a process or a system, arrows between each.",
  role: "diagram",
  recipe: "terminal",
  ownVisual: true,
  schema: payload,
  layout: {
    "9:16": "Boxes stacked top to bottom with arrows between",
    "16:9": "Boxes left to right with arrows between",
    "1:1": "Boxes stacked with arrows between",
  },
  build({ points }, kit) {
    return `
      ${kit.text ? `<p class="fx-list-title sc-center" style="color:${kit.ink}">${kit.escape(kit.text)}</p>` : ""}
      <div class="sc-flow" style="--n:${points.length}">
        ${points
          .map(
            (p, i) => `
        ${i > 0 ? `<span class="sc-flow-arrow" style="color:${kit.accent}">→</span>` : ""}
        <div class="sc-node fx-rv" style="color:${kit.ink};border-color:${kit.accent}">
          <p class="sc-node-label">${kit.escape(p.label)}</p>
          ${p.text ? `<p class="sc-node-text">${kit.escape(p.text)}</p>` : ""}
        </div>`,
          )
          .join("")}
      </div>`;
  },
  sample: {
    headline: "From idea to video",
    narration:
      "A storyboard goes in, the studio lints it, voices it, and renders the video.",
    payload: {
      points: [
        { label: "Storyboard", text: "JSON from a model" },
        { label: "Studio", text: "Lint, voice, scenes" },
        { label: "MP4", text: "Rendered locally" },
      ],
    },
  },
};
