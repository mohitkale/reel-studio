import { z } from "zod";
import type { SceneDefinition } from "../types";

const payload = z.object({
  items: z.array(z.string().min(1)).min(2).max(6),
});
type Payload = z.infer<typeof payload>;

export const checklist: SceneDefinition<Payload> = {
  id: "checklist",
  templateId: "hf-checklist",
  name: "Checklist",
  description: "Things to tick off, each with a check mark that pops in.",
  role: "summary",
  recipe: "stack-cards",
  schema: payload,
  layout: {
    "9:16": "One tick per row down the region",
    "16:9": "One tick per row, wide text",
    "1:1": "One tick per row, compact",
  },
  build({ items }, kit) {
    return `
      ${kit.text ? `<p class="fx-list-title" style="color:${kit.ink}">${kit.escape(kit.text)}</p>` : ""}
      <ul class="sc-checks" style="--n:${items.length}">
        ${items
          .map(
            (item) => `
        <li class="sc-check fx-rv" style="color:${kit.ink}">
          <span class="sc-tick" style="border-color:${kit.accent};color:${kit.accent}">✓</span>
          <span class="sc-check-text">${kit.escape(item)}</span>
        </li>`,
          )
          .join("")}
      </ul>`;
  },
  sample: {
    headline: "Pre-flight check",
    narration: "Check these four things before you hit publish.",
    payload: {
      items: [
        "Hook in three seconds",
        "Captions on",
        "One clear call",
        "Music at a low level",
      ],
    },
  },
};
