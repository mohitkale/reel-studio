import {
  AIError,
  AI_PROVIDER_IDS,
  type AIProvider,
  type AIProviderId,
  type AIProviderStatus,
} from "./types";
import { createGeminiProvider, GEMINI_DEFAULT_MODEL } from "./gemini";
import { createOpenAIProvider, OPENAI_DEFAULT_MODEL } from "./openai";

/**
 * AI provider registry / factory. To add an LLM vendor: implement AIProvider in
 * a new file and add one entry here. Nothing else references vendors directly.
 */
const factories: Record<
  AIProviderId,
  { create: () => AIProvider; defaultModel: string }
> = {
  gemini: { create: createGeminiProvider, defaultModel: GEMINI_DEFAULT_MODEL },
  openai: { create: createOpenAIProvider, defaultModel: OPENAI_DEFAULT_MODEL },
};

const instances = new Map<AIProviderId, AIProvider>();

export function getAIProvider(id: AIProviderId): AIProvider {
  const entry = factories[id];
  if (!entry) throw new AIError(`Unknown AI provider "${id}"`, 404);
  let instance = instances.get(id);
  if (!instance) {
    instance = entry.create();
    instances.set(id, instance);
  }
  return instance;
}

export function isAIProviderId(value: string): value is AIProviderId {
  return (AI_PROVIDER_IDS as readonly string[]).includes(value);
}

export function aiDefaultModelFor(id: AIProviderId): string {
  return factories[id].defaultModel;
}

export function listAIProviderStatuses(): AIProviderStatus[] {
  return AI_PROVIDER_IDS.map((id) => {
    const provider = getAIProvider(id);
    return {
      id,
      label: provider.label,
      configured: provider.isConfigured(),
      defaultModel: factories[id].defaultModel,
    };
  });
}
