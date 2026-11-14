import { z } from "zod";
import type { SceneDefinition } from "../types";

export const side = z.object({
  label: z.string().min(1),
  text: z.string().min(1),
});
const payload = z.object({ left: side, right: side });
type Payload = z.infer<typeof payload>;

export const comparison: SceneDefinition<Payload> = {
  id: "comparison",
  templateId: "hf-comparison",
  name: "Comparison",
  description: "Two options side by side with a versus badge.",
  role: "comparison",
  recipe: "stack-cards",
  ownVisual: true,
  schema: payload,
  layout: {
    "9:16": "Two cards stacked, versus badge between them",
    "16:9": "Two cards side by side, versus badge between them",
    "1:1": "Two cards stacked, versus badge between them",
  },
  build({ left, right }, kit) {
    const card = (s: Payload["left"], cls: string, accent: boolean) => `
      <div class="sc-card ${cls} fx-rv" style="color:${kit.ink};${accent ? `border-color:${kit.accent};border-width:4px` : ""}">
        <p class="sc-card-label" style="color:${kit.ink}">${kit.escape(s.label)}</p>
        <p class="sc-card-text">${kit.escape(s.text)}</p>
      </div>`;
    return `
      ${kit.text ? `<p class="fx-list-title sc-center" style="color:${kit.ink}">${kit.escape(kit.text)}</p>` : ""}
      <div class="sc-compare">
        ${card(left, "sc-left", false)}
        <span class="sc-vs" style="background:${kit.accent};color:${kit.onAccent}">VS</span>
        ${card(right, "sc-right", true)}
      </div>`;
  },
  sample: {
    headline: "Two ways to ship",
    narration: "You can plan for weeks, or ship small and learn every day.",
    payload: {
      left: {
        label: "Big launch",
        text: "Months of work, one chance to be right",
      },
      right: {
        label: "Small steps",
        text: "Weekly releases, real feedback each time",
      },
    },
  },
};
