import { z } from "zod";
import type { SceneDefinition } from "../types";

const payload = z.object({ screen: z.string().optional() });
type Payload = z.infer<typeof payload>;

export const deviceMockup: SceneDefinition<Payload> = {
  id: "device-mockup",
  templateId: "hf-device-mockup",
  name: "Device mockup",
  description:
    "A phone frame showing a picture or a line of screen text, headline beside it.",
  role: "screenshot-demo",
  recipe: "terminal",
  framedMedia: true,
  fixedFill: true,
  schema: payload,
  layout: {
    "9:16": "Phone above, headline below",
    "16:9": "Phone left, headline right",
    "1:1": "Phone left, headline right",
  },
  build({ screen }, kit) {
    const inner = kit.mediaUrl
      ? `<div class="sc-phone-art" style="background-image:url('${kit.mediaUrl}')"></div>`
      : `<div class="sc-phone-art sc-phone-none" style="--a:${kit.accent};color:#fff"><span>${kit.escape(screen ?? "")}</span></div>`;
    return `
      <div class="sc-device">
        <div class="sc-phone fx-rv"><div class="sc-phone-notch"></div>${inner}</div>
        <div class="sc-device-copy" data-fit-share="0.4">
          <div class="fx-stack" style="color:${kit.ink}">${kit.lineStack(kit.text, kit.emphasis, 11, "fx-line sans", 3)}</div>
        </div>
      </div>`;
  },
  sample: {
    headline: "Edit from your phone",
    narration: "Open the app on your phone and tweak any scene in seconds.",
    payload: { screen: "Scene 3 · Edit" },
  },
};
