import { researchCapabilityViewSchema } from "./readiness";
import {
  GEMINI_RESEARCH_MODELS,
  OPENAI_RESEARCH_MODELS,
  researchCapability,
} from "./capabilities";
export function readinessFixture() {
  return researchCapabilityViewSchema.parse({
    version: 1,
    defaultResearchModel: "gemini-2.5-flash",
    configured: false,
    defaultResearchModels: {
      gemini: "gemini-2.5-flash",
      openai: "gpt-4.1-mini",
    },
    configuredProviders: { gemini: false, openai: false },
    capabilities: [
      ...GEMINI_RESEARCH_MODELS.map((id) => researchCapability("gemini", id)),
      ...OPENAI_RESEARCH_MODELS.map((id) => researchCapability("openai", id)),
    ],
    writers: [
      {
        id: "gemini",
        kind: "cloud",
        label: "Gemini",
        configured: false,
        defaultModel: "gemini-2.5-flash-lite",
      },
      {
        id: "openai",
        kind: "cloud",
        label: "OpenAI",
        configured: false,
        defaultModel: "gpt-4o-mini",
      },
      ...(["ollama", "lm-studio", "llama-cpp"] as const).map((id) => ({
        id,
        kind: "local",
        label: id,
        configured: true,
        defaultModel: `${id}-installed`,
      })),
    ],
    bounds: {
      maxProviderCalls: 1,
      maxSearchChargeUnits: 1,
      searchChargeUnits: ["grounded_prompt", "web_search_call"],
      maxUrls: 5,
      maxSources: 5,
      maxDeadlineMs: 45_000,
      maxResponseBytes: 1_000_000,
      maxOutputTokens: 4096,
      maxLocalWriterCalls: 1,
      maxWriterContextChars: 24_000,
    },
  });
}
