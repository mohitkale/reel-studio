import { z } from "zod";
import type { SceneDefinition } from "../types";
import { side } from "../comparison";

const payload = z.object({ left: side, right: side });
type Payload = z.infer<typeof payload>;

export const beforeAfter: SceneDefinition<Payload> = {
  id: "before-after",
  templateId: "hf-before-after",
  name: "Before and after",
  description:
    "A change from a muted before state to a highlighted after state.",
  role: "comparison",
  recipe: "punch-block",
  ownVisual: true,
  schema: payload,
  layout: {
    "9:16": "Before above, after below, an arrow between",
    "16:9": "Before left, after right, an arrow between",
    "1:1": "Before above, after below, an arrow between",
  },
  build({ left, right }, kit) {
    return `
      ${kit.text ? `<p class="fx-list-title sc-center" style="color:${kit.ink}">${kit.escape(kit.text)}</p>` : ""}
      <div class="sc-compare sc-ba">
        <div class="sc-card sc-before fx-rv" style="color:${kit.ink}">
          <p class="sc-card-label">${kit.escape(left.label)}</p>
          <p class="sc-card-text">${kit.escape(left.text)}</p>
        </div>
        <span class="sc-arrow" style="color:${kit.accent}">→</span>
        <div class="sc-card sc-after fx-rv" style="color:${kit.onAccent};background:${kit.accent};border-color:${kit.accent}">
          <p class="sc-card-label">${kit.escape(right.label)}</p>
          <p class="sc-card-text">${kit.escape(right.text)}</p>
        </div>
      </div>`;
  },
  sample: {
    headline: "What changed",
    narration: "Before, every edit took an hour. After, it takes a minute.",
    payload: {
      left: { label: "Before", text: "One hour per edit, by hand" },
      right: { label: "After", text: "One minute, from a storyboard" },
    },
  },
};
