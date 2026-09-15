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
import { parseStructuredOutput } from "./structured-output";
import {
  strictLocalClipSuggestionsSchema,
  strictLocalPodcastPlanSchema,
  strictLocalScenePlanSchema,
} from "./local-structured-schemas";
import { localAIConfigStore } from "@/server/local-ai-config";

type Store = Pick<
  typeof localAIConfigStore,
  "readProvider" | "recordDiagnostic"
>;

async function availableModels(store: Store, signal?: AbortSignal) {
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

async function selectedModel(store: Store, requested?: string) {
  return requested?.trim() || (await store.readProvider("lm-studio")).modelId;
}

async function complete(
  store: Store,
  input: {
    modelId: string;
    system: string;
    user: string;
    jsonSchema: Record<string, unknown>;
    signal?: AbortSignal;
  },
) {
  const config = await store.readProvider("lm-studio");
  if (!input.modelId) {
    throw new AIError(
      "Select an LM Studio model in Settings before planning.",
      400,
      "lm-studio",
    );
  }
  if (
    !(await availableModels(store, input.signal)).some(
      ({ id }) => id === input.modelId,
    )
  ) {
    throw new AIError(
      `LM Studio model “${input.modelId}” is not available. Load it in LM Studio, then refresh model discovery.`,
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
    model: input.modelId,
    temperature: config.temperature,
    system: input.system,
    user: input.user,
    jsonSchema: input.jsonSchema,
    maxOutputTokens: config.maxOutputTokens,
    signal: input.signal,
  });
}

export function createLMStudioProvider(
  store: Store = localAIConfigStore,
): AIProvider {
  return {
    id: "lm-studio",
    label: "LM Studio",
    isConfigured: () => true,
    listModels: (): Promise<AIModel[]> => availableModels(store),

    async generatePlan(input: GeneratePlanInput): Promise<ScenePlan> {
      const prompt = buildPrompt(input);
      const modelId = await selectedModel(store, input.modelId);
      const jsonSchema = buildOpenAIVideoPlanJsonSchema(input);
      const text = await complete(store, {
        ...prompt,
        modelId,
        jsonSchema,
        signal: input.signal,
      });
      const raw = await parseStructuredOutput({
        text,
        schema: strictLocalScenePlanSchema,
        providerId: "lm-studio",
        providerLabel: "LM Studio",
        modelId,
        repair: (repair) =>
          complete(store, {
            ...repair,
            modelId,
            jsonSchema,
            signal: input.signal,
          }),
      });
      return scenePlanSchema.parse(raw);
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
      const modelId = await selectedModel(store, input.modelId);
      const jsonSchema = OPENAI_PODCAST_JSON_SCHEMA;
      const text = await complete(store, {
        ...prompt,
        modelId,
        jsonSchema,
        signal: input.signal,
      });
      const structured = await parseStructuredOutput({
        text,
        schema: strictLocalPodcastPlanSchema,
        providerId: "lm-studio",
        providerLabel: "LM Studio",
        modelId,
        repair: (repair) =>
          complete(store, {
            ...repair,
            modelId,
            jsonSchema,
            signal: input.signal,
          }),
      });
      const raw = podcastAiPlanSchema.parse(structured);
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
      const modelId = await selectedModel(store, input.modelId);
      const jsonSchema = OPENAI_PODCAST_CLIP_SUGGESTIONS_JSON_SCHEMA;
      const text = await complete(store, {
        ...prompt,
        modelId,
        jsonSchema,
        signal: input.signal,
      });
      const structured = await parseStructuredOutput({
        text,
        schema: strictLocalClipSuggestionsSchema,
        providerId: "lm-studio",
        providerLabel: "LM Studio",
        modelId,
        repair: (repair) =>
          complete(store, {
            ...repair,
            modelId,
            jsonSchema,
            signal: input.signal,
          }),
      });
      return podcastClipSuggestionCandidatesSchema.parse(structured)
        .suggestions;
    },
  };
}
