import { z } from "zod";
import type { SceneDefinition } from "../types";

const payload = z.object({ lines: z.array(z.string()).min(1).max(12) });
type Payload = z.infer<typeof payload>;

export const terminal: SceneDefinition<Payload> = {
  id: "terminal",
  templateId: "hf-terminal",
  name: "Terminal",
  description:
    "A shell window: commands in colour, output muted, typed in line by line.",
  role: "terminal",
  recipe: "terminal",
  fixedFill: true,
  schema: payload,
  layout: {
    "9:16": "A window filling the region, lines wrap",
    "16:9": "A wide window, long lines fit",
    "1:1": "A window filling the square region",
  },
  build({ lines }, kit) {
    return `
      <div class="sc-term">
        <div class="sc-term-bar"><i></i><i></i><i></i><span>${kit.escape(kit.text)}</span></div>
        <pre class="sc-term-body">${lines
          .map((line) => {
            const cmd = /^\$\s?/.test(line);
            return `<span class="sc-term-line fx-rv ${cmd ? "sc-cmd" : "sc-out"}" style="color:${cmd ? "#7dd3fc" : "#e5e7eb"}">${kit.escape(line)}</span>`;
          })
          .join("")}</pre>
      </div>`;
  },
  sample: {
    headline: "Run it locally",
    narration:
      "Install, run setup, and open the app. Everything stays on your machine.",
    payload: {
      lines: [
        "$ npm ci",
        "$ npm run setup",
        "$ npm run dev",
        "ready on http://localhost:3000",
      ],
    },
  },
};
