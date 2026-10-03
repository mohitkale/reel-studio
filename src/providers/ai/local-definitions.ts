/** Data-only registrations shared by schemas, settings, diagnostics and factories. */
export interface LocalAIRegistration {
  label: string;
  protocol: "ollama" | "openai-compatible";
  defaults: {
    baseUrl: string;
    temperature: number;
    contextWindow?: number;
    maxOutputTokens?: number;
  };
}

export const LOCAL_AI_DEFINITIONS = {
  ollama: {
    label: "Ollama",
    protocol: "ollama",
    defaults: {
      baseUrl: "http://127.0.0.1:11434",
      temperature: 0.7,
      contextWindow: 8192,
      maxOutputTokens: 4096,
    },
  },
  "lm-studio": {
    label: "LM Studio",
    protocol: "openai-compatible",
    defaults: {
      baseUrl: "http://127.0.0.1:1234",
      temperature: 0.7,
      contextWindow: 8192,
      maxOutputTokens: 4096,
    },
  },
  "llama-cpp": {
    label: "llama.cpp",
    protocol: "openai-compatible",
    defaults: {
      baseUrl: "http://127.0.0.1:8080",
      temperature: 0.7,
      contextWindow: 8192,
      maxOutputTokens: 4096,
    },
  },
} as const satisfies Record<string, LocalAIRegistration>;
export type LocalAIProviderId = keyof typeof LOCAL_AI_DEFINITIONS;
// Object.keys preserves these own, literal registration keys; no runtime plugins.
export const LOCAL_AI_PROVIDER_IDS = Object.keys(
  LOCAL_AI_DEFINITIONS,
) as LocalAIProviderId[];
export function isLocalAIProviderId(id: string): id is LocalAIProviderId {
  return Object.hasOwn(LOCAL_AI_DEFINITIONS, id);
}

export type CompatibleLocalAIProviderId = {
  [
    Id in LocalAIProviderId
  ]: (typeof LOCAL_AI_DEFINITIONS)[Id]["protocol"] extends "openai-compatible"
    ? Id
    : never;
}[LocalAIProviderId];
export function isCompatibleLocalAIProvider(
  id: LocalAIProviderId,
): id is CompatibleLocalAIProviderId {
  return LOCAL_AI_DEFINITIONS[id].protocol === "openai-compatible";
}
