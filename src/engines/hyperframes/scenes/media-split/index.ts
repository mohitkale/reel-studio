import { z } from "zod";
import type { SceneDefinition } from "../types";

const payload = z.object({ caption: z.string().optional() });
type Payload = z.infer<typeof payload>;

export const mediaSplit: SceneDefinition<Payload> = {
  id: "media-split",
  templateId: "hf-media-split",
  name: "Media split",
  description: "A picture in one half, the headline in the other.",
  role: "feature",
  recipe: "lower-third",
  framedMedia: true,
  fixedFill: true,
  schema: payload,
  layout: {
    "9:16": "Picture above, headline below",
    "16:9": "Picture left, headline right",
    "1:1": "Picture above, headline below",
  },
  build({ caption }, kit) {
    const art = kit.mediaUrl
      ? `<div class="sc-media-art" style="background-image:url('${kit.mediaUrl}')"></div>`
      : `<div class="sc-media-art sc-media-none" style="--a:${kit.accent}"></div>`;
    return `
      <div class="sc-split">
        ${art}
        <div class="sc-split-copy" data-fit-share="0.4">
          <div class="fx-stack" style="color:${kit.ink}">${kit.lineStack(kit.text, kit.emphasis, 12, "fx-line sans", 3)}</div>
          ${caption ? `<p class="sc-caption" style="color:${kit.ink}">${kit.escape(caption)}</p>` : ""}
        </div>
      </div>`;
  },
  sample: {
    headline: "See it in action",
    narration: "Here is the idea in motion, one clear picture at a time.",
    payload: {},
  },
};
