import { aiFetch } from "./http";
import { buildPrompt } from "./prompt";
import { buildPodcastPrompt } from "./podcast-prompt";
import {
  normalizePodcastPlan,
  podcastAiPlanSchema,
  type GeneratePodcastPlanInput,
  type PodcastPlan,
} from "./podcast-types";
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

const PODCAST_JSON_SCHEMA = {
  name: "podcast_plan",
  strict: true,
  schema: {
    type: "object",
    additionalProperties: false,
    properties: {
      title: { type: "string" },
      description: { type: "string" },
      characters: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            id: { type: "string" },
            name: { type: "string" },
            gender: { type: "string", enum: ["male", "female", "neutral"] },
          },
          required: ["id", "name", "gender"],
        },
      },
      turns: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            characterId: { type: "string" },
            text: { type: "string" },
          },
          required: ["characterId", "text"],
        },
      },
    },
    required: ["characters", "turns"],
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

    async generatePodcastPlan(
      input: GeneratePodcastPlanInput,
    ): Promise<PodcastPlan> {
      if (input.characters.length < 2) {
        throw new AIError("Podcast needs at least 2 characters", 400, "openai");
      }
      const { system, user } = buildPodcastPrompt(input);
      const model = input.modelId || OPENAI_DEFAULT_MODEL;

      const res = await aiFetch(
        `${API_BASE}/chat/completions`,
        {
          method: "POST",
          headers: headers(),
          body: JSON.stringify({
            model,
            temperature: 0.9,
            messages: [
              { role: "system", content: system },
              { role: "user", content: user },
            ],
            response_format: {
              type: "json_schema",
              json_schema: PODCAST_JSON_SCHEMA,
            },
          }),
        },
        "openai",
      );

      const json = (await res.json()) as {
        choices?: { message?: { content?: string } }[];
      };
      const text = json.choices?.[0]?.message?.content ?? "";
      if (!text) {
        throw new AIError("OpenAI returned an empty response", 502, "openai");
      }

      let parsed: unknown;
      try {
        parsed = JSON.parse(text);
      } catch {
        throw new AIError("OpenAI returned invalid JSON", 502, "openai");
      }
      const raw = podcastAiPlanSchema.parse(parsed);
      try {
        return normalizePodcastPlan(raw, input.characters);
      } catch (e) {
        throw new AIError(
          e instanceof Error ? e.message : String(e),
          502,
          "openai",
        );
      }
    },
  };
}
