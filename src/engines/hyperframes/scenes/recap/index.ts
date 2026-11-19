import { z } from "zod";
import type { SceneDefinition } from "../types";

const payload = z.object({
  items: z.array(z.string().min(1)).min(2).max(6),
});
type Payload = z.infer<typeof payload>;

/**
 * A quick summary of what a chapter (or the whole video) covered: a kicker that
 * says "In short" over two to six short lines, each with a bar in the accent
 * colour. It is the scene a long video uses to bring the viewer back at the end
 * of a chapter.
 */
export const recap: SceneDefinition<Payload> = {
  id: "recap",
  templateId: "hf-recap",
  name: "Recap",
  description:
    "A short summary of what was just covered, one line per point under an 'In short' label.",
  role: "summary",
  recipe: "stack-cards",
  schema: payload,
  layout: {
    "9:16": "Label, then one bar and line per point down the region",
    "16:9": "Label, then one bar and line per point, wide text",
    "1:1": "Label, then one bar and line per point, compact",
  },
  build({ items }, kit) {
    return `
      <p class="sc-recap-kicker" style="color:${kit.accent}">In short</p>
      ${kit.text ? `<p class="fx-list-title" style="color:${kit.ink}">${kit.escape(kit.text)}</p>` : ""}
      <ul class="sc-recap" style="--n:${items.length}">
        ${items
          .map(
            (item) => `
        <li class="sc-recap-row fx-rv" style="color:${kit.ink}">
          <span class="sc-recap-bar" style="background:${kit.accent}"></span>
          <span class="sc-recap-text">${kit.escape(item)}</span>
        </li>`,
          )
          .join("")}
      </ul>`;
  },
  sample: {
    headline: "What we covered",
    narration:
      "So, to recap: sleep saves memories, seven hours is the target, and a dark cool room helps.",
    payload: {
      items: [
        "Sleep saves what you learned",
        "Seven to nine hours is the target",
        "A dark, cool room helps",
      ],
    },
  },
};
