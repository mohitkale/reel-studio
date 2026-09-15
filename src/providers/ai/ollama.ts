import { z } from "zod";

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
import { secureLocalAIFetch } from "./local-http";
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
type JsonSchema = { schema: Record<string, unknown> };

const chatResponseSchema = z.object({
  message: z.object({ content: z.string() }),
});

async function availableModels(store: Store, signal?: AbortSignal) {
  const config = await store.readProvider("ollama");
  const diagnostic = await diagnoseLocalAIProvider("ollama", config, signal);
  await store.recordDiagnostic("ollama", diagnostic);
  if (diagnostic.state === "offline") {
    throw new AIError(diagnostic.message, 503, "ollama");
  }
  if (diagnostic.state === "error") {
    throw new AIError(diagnostic.message, 502, "ollama");
  }
  return (diagnostic.modelIds ?? []).map((id) => ({ id, label: id }));
}

async function readError(response: Response): Promise<string> {
  const body = await response.text().catch(() => "");
  try {
    return z.object({ error: z.string() }).parse(JSON.parse(body)).error;
  } catch {
    return body.slice(0, 300);
  }
}

async function complete(
  store: Store,
  input: {
    modelId: string;
    system: string;
    user: string;
    jsonSchema: JsonSchema;
    signal?: AbortSignal;
  },
): Promise<string> {
  const config = await store.readProvider("ollama");
  if (!input.modelId) {
    throw new AIError(
      "Select an Ollama model in Settings before planning.",
      400,
      "ollama",
    );
  }
  if (
    !(await availableModels(store, input.signal)).some(
      ({ id }) => id === input.modelId,
    )
  ) {
    throw new AIError(
      `Ollama model “${input.modelId}” is not installed. Pull it in Ollama, then refresh model discovery.`,
      404,
      "ollama",
    );
  }
  const response = await secureLocalAIFetch({
    providerId: "ollama",
    baseUrl: config.baseUrl,
    allowLan: config.allowLan,
    path: "/api/chat",
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      model: input.modelId,
      stream: false,
      messages: [
        { role: "system", content: input.system },
        { role: "user", content: input.user },
      ],
      format: input.jsonSchema.schema,
      options: {
        temperature: config.temperature,
        ...(config.contextWindow ? { num_ctx: config.contextWindow } : {}),
        ...(config.maxOutputTokens
          ? { num_predict: config.maxOutputTokens }
          : {}),
      },
    }),
    signal: input.signal,
    timeoutMs: 120_000,
  });
  if (!response.ok) {
    const detail = await readError(response);
    if (response.status === 404 || /not found/i.test(detail)) {
      throw new AIError(
        `Ollama could not load model “${input.modelId}”: ${detail || "model not found"}`,
        404,
        "ollama",
      );
    }
    if (response.status === 503 || /load|memory|runner/i.test(detail)) {
      throw new AIError(
        `Ollama model “${input.modelId}” is installed but could not be loaded. Check Ollama memory and runner status. ${detail}`,
        503,
        "ollama",
      );
    }
    throw new AIError(
      `Ollama planning failed (HTTP ${response.status})${detail ? `: ${detail}` : ""}`,
      response.status,
      "ollama",
    );
  }
  const content = chatResponseSchema.parse(await response.json()).message
    .content;
  if (!content.trim()) {
    throw new AIError("Ollama returned an empty response", 502, "ollama");
  }
  return content;
}

async function selectedModel(store: Store, requested?: string) {
  return requested?.trim() || (await store.readProvider("ollama")).modelId;
}

export function createOllamaProvider(
  store: Store = localAIConfigStore,
): AIProvider {
  return {
    id: "ollama",
    label: "Ollama",
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
        providerId: "ollama",
        providerLabel: "Ollama",
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
        throw new AIError("Podcast needs at least 2 characters", 400, "ollama");
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
        providerId: "ollama",
        providerLabel: "Ollama",
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
          "ollama",
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
        providerId: "ollama",
        providerLabel: "Ollama",
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
