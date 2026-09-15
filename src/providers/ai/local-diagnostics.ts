import { z } from "zod";

import { AIError } from "./types";
import { secureLocalAIFetch } from "./local-http";
import type { LocalAIDiagnosticState, LocalAIProviderId } from "./local-types";

const ollamaTagsSchema = z.object({
  models: z
    .array(z.object({ name: z.string().min(1), model: z.string().optional() }))
    .default([]),
});

const lmStudioModelsSchema = z.object({
  data: z.array(z.object({ id: z.string().min(1) })).default([]),
});

export interface LocalAIDiagnosticConfig {
  baseUrl: string;
  modelId: string;
  allowLan: boolean;
  token?: string;
}

export interface LocalAIDiagnosticResult {
  state: LocalAIDiagnosticState;
  message: string;
  checkedAt: string;
  modelIds?: string[];
}

export async function diagnoseLocalAIProvider(
  providerId: LocalAIProviderId,
  config: LocalAIDiagnosticConfig,
  signal?: AbortSignal,
): Promise<LocalAIDiagnosticResult> {
  const checkedAt = new Date().toISOString();
  try {
    const response = await secureLocalAIFetch({
      providerId,
      baseUrl: config.baseUrl,
      allowLan: config.allowLan,
      path: providerId === "ollama" ? "/api/tags" : "/v1/models",
      headers:
        providerId === "lm-studio" && config.token
          ? { Authorization: `Bearer ${config.token}` }
          : undefined,
      signal,
    });
    if (response.status === 401 || response.status === 403) {
      return {
        state: "authentication-error",
        message: `${providerId} rejected the configured local token.`,
        checkedAt,
      };
    }
    if (!response.ok) {
      return {
        state: "error",
        message: `${providerId} health check failed with HTTP ${response.status}.`,
        checkedAt,
      };
    }

    const json: unknown = await response.json();
    const modelIds =
      providerId === "ollama"
        ? ollamaTagsSchema.parse(json).models.map((model) => model.name)
        : lmStudioModelsSchema.parse(json).data.map((model) => model.id);
    if (!config.modelId) {
      return {
        state: "missing-model",
        message:
          modelIds.length > 0
            ? `Server connected. Select one of ${modelIds.length} discovered models.`
            : "Server connected, but it has no discoverable models.",
        checkedAt,
        modelIds,
      };
    }
    if (!modelIds.includes(config.modelId)) {
      return {
        state: "missing-model",
        message: `Server connected, but model “${config.modelId}” is not available.`,
        checkedAt,
        modelIds,
      };
    }
    return {
      state: "healthy",
      message: `Server connected and model “${config.modelId}” is available.`,
      checkedAt,
      modelIds,
    };
  } catch (error) {
    if (error instanceof AIError) {
      if (error.status === 499) throw error;
      return {
        state:
          error.status === 503 || error.status === 504 ? "offline" : "error",
        message: error.message,
        checkedAt,
      };
    }
    return {
      state: "error",
      message:
        error instanceof Error
          ? `The server response could not be read: ${error.message}`
          : "The server response could not be read.",
      checkedAt,
    };
  }
}
