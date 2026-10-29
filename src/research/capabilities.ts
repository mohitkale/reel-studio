/** Curated allowlist, independent of generation/model discovery. Checked 2026-10-29. */
export const GEMINI_RESEARCH_MODELS = [
  "gemini-2.5-flash",
  "gemini-2.5-flash-lite",
  "gemini-2.5-pro",
] as const;
export const GEMINI_RESEARCH_DEFAULT_MODEL = "gemini-2.5-flash";
export const GEMINI_RESEARCH_ENDPOINT = "v1beta/models:generateContent";
export const OPENAI_RESEARCH_MODELS = ["gpt-4.1-mini", "gpt-4.1"] as const;
export const OPENAI_RESEARCH_DEFAULT_MODEL = "gpt-4.1-mini";
export const OPENAI_RESEARCH_ENDPOINT = "v1/responses";

export function defaultResearchModel(providerId?: string) {
  return providerId === "openai"
    ? OPENAI_RESEARCH_DEFAULT_MODEL
    : GEMINI_RESEARCH_DEFAULT_MODEL;
}

export function researchCapability(providerId: string, modelId: string) {
  const geminiSearch =
    providerId === "gemini" &&
    GEMINI_RESEARCH_MODELS.some((id) => id === modelId);
  const openaiSearch =
    providerId === "openai" &&
    OPENAI_RESEARCH_MODELS.some((id) => id === modelId);
  const nativeSearch = geminiSearch || openaiSearch;
  return {
    providerId,
    modelId,
    nativeSearch,
    urlContext: geminiSearch,
    endpoint: geminiSearch
      ? GEMINI_RESEARCH_ENDPOINT
      : openaiSearch
        ? OPENAI_RESEARCH_ENDPOINT
        : null,
    suppliedSources: [
      "gemini",
      "openai",
      "ollama",
      "lm-studio",
      "llama-cpp",
    ].includes(providerId),
    // M2 will wire explicit shared research backends for local writers.
    sharedBackend: false,
    searchChargeUnit: geminiSearch
      ? "grounded_prompt"
      : openaiSearch
        ? "web_search_call"
        : null,
    reason: nativeSearch
      ? null
      : "Native research is not enabled for this provider/model. Use supplied sources or select a listed Gemini or OpenAI research model.",
  } as const;
}
