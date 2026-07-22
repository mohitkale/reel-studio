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

const API_BASE = "https://api.openai.com/v1";
export const OPENAI_DEFAULT_MODEL = "gpt-4o-mini";

// OpenAI structured-output schema (strict: every key required, no extras).
const JSON_SCHEMA = {
  name: "scene_plan",
  strict: true,
  schema: {
    type: "object",
    additionalProperties: false,
    properties: {
      projectName: { type: "string" },
      scriptName: { type: "string" },
      styleId: {
        type: "string",
        enum: ["bold-hook", "clean-story", "teach-me", "soft-brand"],
      },
      energy: {
        type: "string",
        enum: ["calm", "normal", "high"],
      },
      scenes: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            text: { type: "string" },
            spokenText: { type: "string" },
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
            items: { type: "array", items: { type: "string" } },
            backgroundQuery: { type: "string" },
            effect: {
              type: "string",
              enum: ["ken-burns", "pan-left", "pan-right", "pan-up", "pan-down"],
            },
            mood: {
              type: "string",
              enum: [
                "energetic",
                "calm",
                "dramatic",
                "playful",
                "inspiring",
                "tech",
                "nature",
              ],
            },
            musicMood: { type: "string" },
          },
          required: ["text", "templateId", "emphasis"],
        },
      },
    },
    required: ["projectName", "scriptName", "styleId", "energy", "scenes"],
  },
};

export function createOpenAIProvider(): AIProvider {
  const key = () => process.env.OPENAI_API_KEY?.trim() || "";
  const headers = () => ({
    Authorization: `Bearer ${key()}`,
    "content-type": "application/json",
  });

  return {
    id: "openai",
    label: "OpenAI",

    isConfigured: () => key().length > 0,

    async listModels(): Promise<AIModel[]> {
      const res = await aiFetch(
        `${API_BASE}/models`,
        { method: "GET", headers: headers() },
        "openai",
      );
      const json = (await res.json()) as { data?: { id: string }[] };
      return (json.data ?? [])
        .map((m) => m.id)
        .filter((id) => id.startsWith("gpt-") && !id.includes("realtime"))
        .sort()
        .map((id) => ({ id, label: id }));
    },

    async generatePlan(input: GeneratePlanInput): Promise<ScenePlan> {
      const { system, user } = buildPrompt(input);
      const model = input.modelId || OPENAI_DEFAULT_MODEL;

      const res = await aiFetch(
        `${API_BASE}/chat/completions`,
        {
          method: "POST",
          headers: headers(),
          body: JSON.stringify({
            model,
            temperature: 0.85,
            messages: [
              { role: "system", content: system },
              { role: "user", content: user },
            ],
            response_format: { type: "json_schema", json_schema: JSON_SCHEMA },
          }),
        },
        "openai",
      );

      const json = (await res.json()) as {
        choices?: { message?: { content?: string } }[];
      };
      const text = json.choices?.[0]?.message?.content ?? "";
      if (!text) throw new AIError("OpenAI returned an empty response", 502, "openai");

      let parsed: unknown;
      try {
        parsed = JSON.parse(text);
      } catch {
        throw new AIError("OpenAI returned invalid JSON", 502, "openai");
      }
      return scenePlanSchema.parse(parsed);
    },
  };
}
