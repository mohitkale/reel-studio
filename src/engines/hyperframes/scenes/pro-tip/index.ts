import { z } from "zod";

import { iconSvg } from "../../assets/icons";
import type { SceneDefinition } from "../types";
import { px } from "../units";

const payload = z.object({
  items: z.array(z.string().min(1)).min(2).max(6),
});
type Payload = z.infer<typeof payload>;

export const proTip: SceneDefinition<Payload> = {
  id: "pro-tip",
  templateId: "hf-pro-tip",
  name: "Pro Tip",
  description: "A lightbulb badge over two to six practical tips.",
  role: "tip",
  recipe: "stack-cards",
  schema: payload,
  layout: {
    "9:16": "Badge and heading above a column of tips",
    "16:9": "Badge and heading above wide tips",
    "1:1": "Compact badge, heading and tips",
  },
  css: `
    .fx-panelled .fx-dialogue:has(> .sc-pro-tip) { align-items: stretch; text-align: left; justify-content: center; }
    .fx-panelled .fx-dialogue:has(> .sc-pro-tip) > .fx-icon-badge { display: none; }
    .sc-pro-tip { display: grid; gap: ${px(0.013)}; width: 100%; }
    .sc-pro-tip-badge { display: grid; place-items: center; justify-self: start; width: ${px(0.049)}; height: ${px(0.049)}; border-radius: 50%; }
    .sc-pro-tip-badge svg { width: ${px(0.023)}; height: ${px(0.023)}; }
    .sc-pro-tip .fx-list-title { margin: 0; font-size: ${px(0.049)}; line-height: 1.09; }
    .sc-pro-tip-list { list-style: none; margin: 0; padding: 0; display: grid; gap: ${px(0.007)}; }
    .sc-pro-tip-row { padding-inline-start: ${px(0.013)}; border-inline-start: ${px(0.004)} solid; font-size: ${px(0.036)}; font-weight: 650; line-height: 1.12; }
  `,
  build({ items }, kit) {
    return `
      <section class="sc-pro-tip" style="color:${kit.ink}">
        <span class="sc-pro-tip-badge" style="background:${kit.accent};color:${kit.onAccent}">${iconSvg("lightbulb")}</span>
        ${kit.text ? `<p class="fx-list-title" style="color:${kit.ink}">${kit.escape(kit.text)}</p>` : ""}
        <ul class="sc-pro-tip-list">
          ${items
            .map(
              (item) =>
                `<li class="sc-pro-tip-row fx-rv" style="border-color:${kit.accent}">${kit.escape(item)}</li>`,
            )
            .join("")}
        </ul>
      </section>`;
  },
  sample: {
    headline: "Make the voiceover clearer",
    narration:
      "Write one spoken idea per line, leave a pause after the key point, and read your script aloud.",
    payload: {
      items: [
        "One idea per line",
        "Pause after the key point",
        "Read it aloud",
      ],
    },
  },
};
