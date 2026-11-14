import { z } from "zod";
import type { SceneDefinition } from "../types";

const payload = z.object({
  term: z.string().min(1),
  meaning: z.string().min(1),
});
type Payload = z.infer<typeof payload>;

export const definition: SceneDefinition<Payload> = {
  id: "definition",
  templateId: "hf-definition",
  name: "Definition",
  description: "A term set large with its plain-words meaning beneath.",
  role: "explanation",
  recipe: "stack-cards",
  schema: payload,
  layout: {
    "9:16": "Term large at the top of the region, meaning below",
    "16:9": "Term large on the left, meaning on the right",
    "1:1": "Term large at the top, meaning below",
  },
  build({ term, meaning }, kit) {
    return `
      <div class="sc-define">
        <p class="sc-define-kicker fx-rv" style="background:${kit.accent};color:${kit.onAccent}">${kit.text ? kit.escape(kit.text) : "DEFINITION"}</p>
        <p class="sc-define-term fx-rv" style="color:${kit.ink}">${kit.escape(term)}</p>
        <div class="fx-rule" style="background:${kit.accent}"></div>
        <p class="sc-define-meaning fx-rv" style="color:${kit.ink}">${kit.escape(meaning)}</p>
      </div>`;
  },
  sample: {
    headline: "In plain words",
    narration: "Latency is the wait between asking and getting an answer.",
    payload: {
      term: "Latency",
      meaning: "The wait between asking for something and getting it.",
    },
  },
};
