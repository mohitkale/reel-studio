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
import {
  buildOpenAIVideoPlanJsonSchema,
  OPENAI_PODCAST_CLIP_SUGGESTIONS_JSON_SCHEMA,
  OPENAI_PODCAST_JSON_SCHEMA,
} from "./openai-compatible-schemas";
import { createLocalOpenAICompatibleTransport } from "./openai-compatible";
import { diagnoseLocalAIProvider } from "./local-diagnostics";
import { localAIConfigStore } from "@/server/local-ai-config";

type LocalAIConfigStore = Pick<
  typeof localAIConfigStore,
  "readProvider" | "recordDiagnostic"
>;

function parseJson(text: string, description: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    throw new AIError(
      `LM Studio returned malformed ${description}`,
      502,
      "lm-studio",
    );
  }
}

async function availableModels(
  store: LocalAIConfigStore,
  signal?: AbortSignal,
): Promise<AIModel[]> {
  const config = await store.readProvider("lm-studio");
  const diagnostic = await diagnoseLocalAIProvider("lm-studio", config, signal);
  await store.recordDiagnostic("lm-studio", diagnostic);
  if (diagnostic.state === "offline") {
    throw new AIError(diagnostic.message, 503, "lm-studio");
  }
  if (diagnostic.state === "authentication-error") {
    throw new AIError(diagnostic.message, 401, "lm-studio");
  }
  if (diagnostic.state === "error") {
    throw new AIError(diagnostic.message, 502, "lm-studio");
  }
  return (diagnostic.modelIds ?? []).map((id) => ({ id, label: id }));
}

async function completion(
  store: LocalAIConfigStore,
  input: {
    modelId?: string;
    system: string;
    user: string;
    jsonSchema: Record<string, unknown>;
    signal?: AbortSignal;
  },
): Promise<string> {
  const config = await store.readProvider("lm-studio");
  const model = input.modelId?.trim() || config.modelId;
  if (!model) {
    throw new AIError(
      "Select an LM Studio model in Settings before planning.",
      400,
      "lm-studio",
    );
  }
  const models = await availableModels(store, input.signal);
  if (!models.some(({ id }) => id === model)) {
    throw new AIError(
      `LM Studio model “${model}” is not available. Load it in LM Studio, then refresh model discovery.`,
      404,
      "lm-studio",
    );
  }
  return createLocalOpenAICompatibleTransport({
    providerId: "lm-studio",
    label: "LM Studio",
    baseUrl: config.baseUrl,
    allowLan: config.allowLan,
    token: config.token,
    timeoutMs: 120_000,
  }).complete({
    model,
    temperature: config.temperature,
    system: input.system,
    user: input.user,
    jsonSchema: input.jsonSchema,
    maxOutputTokens: config.maxOutputTokens,
    signal: input.signal,
  });
}

export function createLMStudioProvider(
  store: LocalAIConfigStore = localAIConfigStore,
): AIProvider {
  return {
    id: "lm-studio",
    label: "LM Studio",
    isConfigured: () => true,
    listModels: () => availableModels(store),

    async generatePlan(input: GeneratePlanInput): Promise<ScenePlan> {
      const prompt = buildPrompt(input);
      const text = await completion(store, {
        ...prompt,
        modelId: input.modelId,
        jsonSchema: buildOpenAIVideoPlanJsonSchema(input),
        signal: input.signal,
      });
      return scenePlanSchema.parse(parseJson(text, "JSON"));
    },

    async generatePodcastPlan(
      input: GeneratePodcastPlanInput,
    ): Promise<PodcastPlan> {
      if (input.characters.length < 2) {
        throw new AIError(
          "Podcast needs at least 2 characters",
          400,
          "lm-studio",
        );
      }
      const prompt = buildPodcastPrompt(input);
      const text = await completion(store, {
        ...prompt,
        modelId: input.modelId,
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
          "lm-studio",
        );
      }
    },

    async generatePodcastClipSuggestions(
      input: GeneratePodcastClipSuggestionsInput,
    ): Promise<PodcastClipSuggestionCandidate[]> {
      const prompt = buildPodcastClipSuggestionsPrompt(input);
      const text = await completion(store, {
        ...prompt,
        modelId: input.modelId,
        jsonSchema: OPENAI_PODCAST_CLIP_SUGGESTIONS_JSON_SCHEMA,
        signal: input.signal,
      });
      return podcastClipSuggestionCandidatesSchema.parse(
        parseJson(text, "clip suggestions"),
      ).suggestions;
    },
  };
}
