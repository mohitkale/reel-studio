import { z } from "zod";
import type { SceneDefinition } from "../types";

export const point = z.object({
  label: z.string().min(1),
  text: z.string().min(1).optional(),
});
const payload = z.object({ points: z.array(point).min(2).max(5) });
type Payload = z.infer<typeof payload>;

export const timeline: SceneDefinition<Payload> = {
  id: "timeline",
  templateId: "hf-timeline",
  name: "Timeline",
  description: "Moments in order along a line, each with a date and a detail.",
  role: "explanation",
  recipe: "stack-cards",
  ownVisual: true,
  schema: payload,
  layout: {
    "9:16": "A vertical line with the moments top to bottom",
    "16:9": "A horizontal line with the moments left to right",
    "1:1": "A vertical line with the moments top to bottom",
  },
  build({ points }, kit) {
    return `
      ${kit.text ? `<p class="fx-list-title" style="color:${kit.ink}">${kit.escape(kit.text)}</p>` : ""}
      <ol class="sc-timeline" style="--n:${points.length}">
        ${points
          .map(
            (p) => `
        <li class="sc-moment fx-rv" style="color:${kit.ink}">
          <span class="sc-dot" style="background:${kit.accent}"></span>
          <span class="sc-moment-body">
            <b class="sc-moment-label" style="color:${kit.accent}">${kit.escape(p.label)}</b>
            ${p.text ? `<span class="sc-moment-text">${kit.escape(p.text)}</span>` : ""}
          </span>
        </li>`,
          )
          .join("")}
      </ol>`;
  },
  sample: {
    headline: "How we got here",
    narration:
      "It started in 2019, passed a million users in 2022, and now runs offline.",
    payload: {
      points: [
        { label: "2019", text: "First prototype" },
        { label: "2022", text: "One million users" },
        { label: "2025", text: "Runs fully offline" },
      ],
    },
  },
};
