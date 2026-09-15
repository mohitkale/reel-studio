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
import { localAIConfigStore } from "@/server/local-ai-config";

type LocalAIConfigStore = Pick<
  typeof localAIConfigStore,
  "readProvider" | "recordDiagnostic"
>;

const ollamaChatResponseSchema = z.object({
  message: z.object({ content: z.string() }),
  done_reason: z.string().optional(),
});

async function readError(response: Response): Promise<string> {
  const body = await response.text().catch(() => "");
  try {
    const parsed = z.object({ error: z.string() }).parse(JSON.parse(body));
    return parsed.error;
  } catch {
    return body.slice(0, 300);
  }
}

function parseJson(text: string, description: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    throw new AIError(
      `Ollama returned malformed ${description}`,
      502,
      "ollama",
    );
  }
}

async function availableModels(
  store: LocalAIConfigStore,
  signal?: AbortSignal,
): Promise<AIModel[]> {
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

async function complete(
  input: {
    modelId?: string;
    system: string;
    user: string;
    jsonSchema: { schema: Record<string, unknown> };
    temperature: number;
    signal?: AbortSignal;
  },
  store: LocalAIConfigStore,
): Promise<string> {
  const config = await store.readProvider("ollama");
  const model = input.modelId?.trim() || config.modelId;
  if (!model) {
    throw new AIError(
      "Select an Ollama model in Settings before planning.",
      400,
      "ollama",
    );
  }
  const models = await availableModels(store, input.signal);
  if (!models.some(({ id }) => id === model)) {
    throw new AIError(
      `Ollama model “${model}” is not installed. Pull it in Ollama, then refresh model discovery.`,
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
      model,
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
        `Ollama could not load model “${model}”: ${detail || "model not found"}`,
        404,
        "ollama",
      );
    }
    if (response.status === 503 || /load|memory|runner/i.test(detail)) {
      throw new AIError(
        `Ollama model “${model}” is installed but could not be loaded. Check Ollama memory and runner status. ${detail}`,
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
  const parsed = ollamaChatResponseSchema.parse(await response.json());
  if (!parsed.message.content.trim()) {
    throw new AIError("Ollama returned an empty response", 502, "ollama");
  }
  return parsed.message.content;
}

export function createOllamaProvider(
  store: LocalAIConfigStore = localAIConfigStore,
): AIProvider {
  return {
    id: "ollama",
    label: "Ollama",
    isConfigured: () => true,
    listModels: () => availableModels(store),

    async generatePlan(input: GeneratePlanInput): Promise<ScenePlan> {
      const prompt = buildPrompt(input);
      const text = await complete(
        {
          ...prompt,
          modelId: input.modelId,
          jsonSchema: buildOpenAIVideoPlanJsonSchema(input),
          temperature: 0.7,
          signal: input.signal,
        },
        store,
      );
      return scenePlanSchema.parse(parseJson(text, "JSON"));
    },

    async generatePodcastPlan(
      input: GeneratePodcastPlanInput,
    ): Promise<PodcastPlan> {
      if (input.characters.length < 2) {
        throw new AIError("Podcast needs at least 2 characters", 400, "ollama");
      }
      const prompt = buildPodcastPrompt(input);
      const text = await complete(
        {
          ...prompt,
          modelId: input.modelId,
          jsonSchema: OPENAI_PODCAST_JSON_SCHEMA,
          temperature: 0.7,
          signal: input.signal,
        },
        store,
      );
      const raw = podcastAiPlanSchema.parse(parseJson(text, "JSON"));
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
      const text = await complete(
        {
          ...prompt,
          modelId: input.modelId,
          jsonSchema: OPENAI_PODCAST_CLIP_SUGGESTIONS_JSON_SCHEMA,
          temperature: 0.3,
          signal: input.signal,
        },
        store,
      );
      return podcastClipSuggestionCandidatesSchema.parse(
        parseJson(text, "clip suggestions"),
      ).suggestions;
    },
  };
}
