import { aiFetch } from "./http";
import { buildPrompt } from "./prompt";
import {
  AIError,
  scenePlanSchema,
  type AIModel,
  type AIProvider,
  type GeneratePlanInput,
  type ScenePlan,
} from "./types";

const API_BASE = "https://generativelanguage.googleapis.com/v1beta";
// flash-lite has the most free-tier/availability headroom; full flash often 503s.
export const GEMINI_DEFAULT_MODEL = "gemini-2.5-flash-lite";

// Gemini responseSchema (OpenAPI subset).
const RESPONSE_SCHEMA = {
  type: "object",
  properties: {
    projectName: { type: "string" },
    scriptName: { type: "string" },
    scenes: {
      // No maxItems here: Gemini's structured-output engine multiplies nested
      // array bounds by per-item enum sizes into a "states" budget, and a bound
      // array of multi-enum objects overflows it (HTTP 400). The 20-scene cap is
      // enforced by the prompt and by scenePlanSchema (.max(20)) instead.
      type: "array",
      items: {
        type: "object",
        properties: {
          text: { type: "string" },
          templateId: {
            type: "string",
            enum: [
              "kinetic",
              "lottie",
              "three",
              "stat-reveal",
              "icon-grid",
              "quote-card",
              "emoji-punch",
            ],
          },
          emphasis: { type: "array", items: { type: "string" } },
          visual: { type: "string" },
          backgroundQuery: { type: "string" },
          // Plain string (not enum) to keep Gemini's schema state budget small;
          // aiSceneSchema validates/normalizes it to a real pan effect.
          effect: { type: "string" },
        },
        required: ["text", "templateId", "emphasis"],
      },
    },
  },
  required: ["projectName", "scriptName", "scenes"],
};

export function createGeminiProvider(): AIProvider {
  const key = () => process.env.GEMINI_API_KEY?.trim() || "";
  const headers = () => ({
    "x-goog-api-key": key(),
    "content-type": "application/json",
  });

  return {
    id: "gemini",
    label: "Google Gemini",

    isConfigured: () => key().length > 0,

    async listModels(): Promise<AIModel[]> {
      const res = await aiFetch(
        `${API_BASE}/models`,
        { method: "GET", headers: headers() },
        "gemini",
      );
      const json = (await res.json()) as {
        models?: {
          name: string;
          displayName?: string;
          supportedGenerationMethods?: string[];
        }[];
      };
      return (json.models ?? [])
        .filter((m) =>
          m.supportedGenerationMethods?.includes("generateContent"),
        )
        .map((m) => m.name.replace(/^models\//, ""))
        .filter((id) => id.includes("flash") || id.includes("pro"))
        .map((id) => ({ id, label: id }));
    },

    async generatePlan(input: GeneratePlanInput): Promise<ScenePlan> {
      const { system, user } = buildPrompt(input);
      const model = input.modelId || GEMINI_DEFAULT_MODEL;

      const res = await aiFetch(
        `${API_BASE}/models/${model}:generateContent`,
        {
          method: "POST",
          headers: headers(),
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: system }] },
            contents: [{ role: "user", parts: [{ text: user }] }],
            generationConfig: {
              responseMimeType: "application/json",
              responseSchema: RESPONSE_SCHEMA,
              temperature: 0.85,
            },
          }),
        },
        "gemini",
      );

      const json = (await res.json()) as {
        candidates?: { content?: { parts?: { text?: string }[] } }[];
      };
      const text =
        json.candidates?.[0]?.content?.parts
          ?.map((p) => p.text ?? "")
          .join("") ?? "";
      if (!text) throw new AIError("Gemini returned an empty response", 502, "gemini");

      let parsed: unknown;
      try {
        parsed = JSON.parse(text);
      } catch {
        throw new AIError("Gemini returned invalid JSON", 502, "gemini");
      }
      return scenePlanSchema.parse(parsed);
    },
  };
}
