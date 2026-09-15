import { buildPrompt } from "./prompt";
import { buildPodcastPrompt } from "./podcast-prompt";
import {
  buildPodcastClipSuggestionsPrompt,
  podcastClipSuggestionCandidatesSchema,
  type GeneratePodcastClipSuggestionsInput,
  type PodcastClipSuggestionCandidate,
} from "./podcast-clip-suggestions";
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
import { createOpenAICloudTransport } from "./openai-compatible";
import {
  buildOpenAIVideoPlanJsonSchema,
  OPENAI_PODCAST_CLIP_SUGGESTIONS_JSON_SCHEMA,
  OPENAI_PODCAST_JSON_SCHEMA,
} from "./openai-compatible-schemas";

export const OPENAI_DEFAULT_MODEL = "gpt-4o-mini";

function parseJson(text: string, description: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    throw new AIError(`OpenAI returned invalid ${description}`, 502, "openai");
  }
}

export function createOpenAIProvider(): AIProvider {
  const key = () => process.env.OPENAI_API_KEY?.trim() || "";
  const transport = createOpenAICloudTransport(key);

  return {
    id: "openai",
    label: "OpenAI",

    isConfigured: () => key().length > 0,

    async listModels(): Promise<AIModel[]> {
      return (await transport.listModels()).filter(
        ({ id }) => id.startsWith("gpt-") && !id.includes("realtime"),
      );
    },

    async generatePlan(input: GeneratePlanInput): Promise<ScenePlan> {
      const { system, user } = buildPrompt(input);
      const text = await transport.complete({
        model: input.modelId || OPENAI_DEFAULT_MODEL,
        temperature: 0.85,
        system,
        user,
        jsonSchema: buildOpenAIVideoPlanJsonSchema(input),
        signal: input.signal,
      });
      return scenePlanSchema.parse(parseJson(text, "JSON"));
    },

    async generatePodcastPlan(
      input: GeneratePodcastPlanInput,
    ): Promise<PodcastPlan> {
      if (input.characters.length < 2) {
        throw new AIError("Podcast needs at least 2 characters", 400, "openai");
      }
      const { system, user } = buildPodcastPrompt(input);
      const text = await transport.complete({
        model: input.modelId || OPENAI_DEFAULT_MODEL,
        temperature: 0.9,
        system,
        user,
        jsonSchema: OPENAI_PODCAST_JSON_SCHEMA,
        signal: input.signal,
      });
      const raw = podcastAiPlanSchema.parse(parseJson(text, "JSON"));
      try {
        return normalizePodcastPlan(raw, input.characters);
      } catch (error) {
        throw new AIError(
          error instanceof Error ? error.message : String(error),
          502,
          "openai",
        );
      }
    },

    async generatePodcastClipSuggestions(
      input: GeneratePodcastClipSuggestionsInput,
    ): Promise<PodcastClipSuggestionCandidate[]> {
      const { system, user } = buildPodcastClipSuggestionsPrompt(input);
      const text = await transport.complete({
        model: input.modelId || OPENAI_DEFAULT_MODEL,
        temperature: 0.3,
        system,
        user,
        jsonSchema: OPENAI_PODCAST_CLIP_SUGGESTIONS_JSON_SCHEMA,
        signal: input.signal,
      });
      try {
        return podcastClipSuggestionCandidatesSchema.parse(JSON.parse(text))
          .suggestions;
      } catch {
        throw new AIError(
          "OpenAI returned invalid clip suggestions",
          502,
          "openai",
        );
      }
    },
  };
}
