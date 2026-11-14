import { z } from "zod";
import type { SceneDefinition } from "../types";

const payload = z.object({
  items: z.array(z.string().min(1)).min(2).max(6),
});
type Payload = z.infer<typeof payload>;

export const steps: SceneDefinition<Payload> = {
  id: "steps",
  templateId: "hf-steps",
  name: "Numbered steps",
  description: "Steps in order with big numerals joined by a rail.",
  role: "explanation",
  recipe: "stack-cards",
  schema: payload,
  layout: {
    "9:16": "One step per row down the region, numerals on the left",
    "16:9": "One step per row, numerals on the left, wide text",
    "1:1": "One step per row, compact numerals",
  },
  build({ items }, kit) {
    return `
      ${kit.text ? `<p class="fx-list-title" style="color:${kit.ink}">${kit.escape(kit.text)}</p>` : ""}
      <ol class="sc-steps" style="--n:${items.length}">
        ${items
          .map(
            (item, i) => `
        <li class="sc-step fx-rv" style="color:${kit.ink}">
          <span class="sc-step-num" style="background:${kit.accent};color:${kit.onAccent}">${i + 1}</span>
          <span class="sc-step-text">${kit.escape(item)}</span>
        </li>`,
          )
          .join("")}
      </ol>`;
  },
  sample: {
    headline: "How to start",
    narration: "Three steps. Pick one goal, block the time, then ship it.",
    payload: { items: ["Pick one goal", "Block the time", "Ship it today"] },
  },
};
