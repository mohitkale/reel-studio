import {
  LOCAL_AI_DEFINITIONS,
  type CompatibleLocalAIProviderId,
} from "./local-definitions";
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

async function availableModels(
  store: Store,
  id: CompatibleLocalAIProviderId,
  signal?: AbortSignal,
) {
  const config = await store.readProvider(id);
  const diagnostic = await diagnoseLocalAIProvider(id, config, signal);
  await store.recordDiagnostic(id, diagnostic);
  if (diagnostic.state === "offline") {
    throw new AIError(diagnostic.message, 503, id);
  }
  if (diagnostic.state === "authentication-error") {
    throw new AIError(diagnostic.message, 401, id);
  }
  if (diagnostic.state === "error") {
    throw new AIError(diagnostic.message, 502, id);
  }
  return (diagnostic.modelIds ?? []).map((id) => ({ id, label: id }));
}

async function selectedModel(
  store: Store,
  id: CompatibleLocalAIProviderId,
  requested?: string,
) {
  return requested?.trim() || (await store.readProvider(id)).modelId;
}

async function complete(
  store: Store,
  id: CompatibleLocalAIProviderId,
  input: {
    modelId: string;
    system: string;
    user: string;
    jsonSchema: Record<string, unknown>;
    signal?: AbortSignal;
  },
) {
  const config = await store.readProvider(id);
  if (!input.modelId) {
    throw new AIError(
      `Select a ${LOCAL_AI_DEFINITIONS[id].label} model in Settings before planning.`,
      400,
      id,
    );
  }
  if (
    !(await availableModels(store, id, input.signal)).some(
      ({ id }) => id === input.modelId,
    )
  ) {
    throw new AIError(
      `${LOCAL_AI_DEFINITIONS[id].label} model “${input.modelId}” is not available. Load it on the configured server, then refresh model discovery.`,
      404,
      id,
    );
  }
  return createLocalOpenAICompatibleTransport({
    providerId: id,
    label: LOCAL_AI_DEFINITIONS[id].label,
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

export function createLocalCompatibleProvider(
  id: CompatibleLocalAIProviderId,
  store: Store = localAIConfigStore,
): AIProvider {
  return {
    id: id,
    label: LOCAL_AI_DEFINITIONS[id].label,
    isConfigured: () => true,
    listModels: (): Promise<AIModel[]> => availableModels(store, id),

    async generatePlan(input: GeneratePlanInput): Promise<ScenePlan> {
      const prompt = buildPrompt(input);
      const modelId = await selectedModel(store, id, input.modelId);
      const jsonSchema = buildOpenAIVideoPlanJsonSchema(input);
      const text = await complete(store, id, {
        ...prompt,
        modelId,
        jsonSchema,
        signal: input.signal,
      });
      const raw = await parseStructuredOutput({
        text,
        schema: strictLocalScenePlanSchema,
        providerId: id,
        providerLabel: LOCAL_AI_DEFINITIONS[id].label,
        modelId,
        repair: (repair) =>
          complete(store, id, {
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
        throw new AIError("Podcast needs at least 2 characters", 400, id);
      }
      const prompt = buildPodcastPrompt(input);
      const modelId = await selectedModel(store, id, input.modelId);
      const jsonSchema = OPENAI_PODCAST_JSON_SCHEMA;
      const text = await complete(store, id, {
        ...prompt,
        modelId,
        jsonSchema,
        signal: input.signal,
      });
      const structured = await parseStructuredOutput({
        text,
        schema: strictLocalPodcastPlanSchema,
        providerId: id,
        providerLabel: LOCAL_AI_DEFINITIONS[id].label,
        modelId,
        repair: (repair) =>
          complete(store, id, {
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
          id,
        );
      }
    },

    async generatePodcastClipSuggestions(
      input: GeneratePodcastClipSuggestionsInput,
    ): Promise<PodcastClipSuggestionCandidate[]> {
      const prompt = buildPodcastClipSuggestionsPrompt(input);
      const modelId = await selectedModel(store, id, input.modelId);
      const jsonSchema = OPENAI_PODCAST_CLIP_SUGGESTIONS_JSON_SCHEMA;
      const text = await complete(store, id, {
        ...prompt,
        modelId,
        jsonSchema,
        signal: input.signal,
      });
      const structured = await parseStructuredOutput({
        text,
        schema: strictLocalClipSuggestionsSchema,
        providerId: id,
        providerLabel: LOCAL_AI_DEFINITIONS[id].label,
        modelId,
        repair: (repair) =>
          complete(store, id, {
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

/** Existing imports keep working; the implementation is shared by registrations. */
export function createLMStudioProvider(
  store: Store = localAIConfigStore,
): AIProvider {
  return createLocalCompatibleProvider("lm-studio", store);
}
