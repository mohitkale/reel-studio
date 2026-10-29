/** Curated allowlist, independent of generation/model discovery. Checked 2026-10-29. */
export const GEMINI_RESEARCH_MODELS = [
  "gemini-2.5-flash",
  "gemini-2.5-flash-lite",
  "gemini-2.5-pro",
] as const;
export const GEMINI_RESEARCH_DEFAULT_MODEL = "gemini-2.5-flash";
export const GEMINI_RESEARCH_ENDPOINT = "v1beta/models:generateContent";

export function researchCapability(providerId: string, modelId: string) {
  const nativeSearch =
    providerId === "gemini" &&
    GEMINI_RESEARCH_MODELS.some((id) => id === modelId);
  return {
    providerId,
    modelId,
    nativeSearch,
    urlContext: nativeSearch,
    endpoint: nativeSearch ? GEMINI_RESEARCH_ENDPOINT : null,
    suppliedSources: [
      "gemini",
      "openai",
      "ollama",
      "lm-studio",
      "llama-cpp",
    ].includes(providerId),
    // M2 will wire explicit shared research backends for local writers.
    sharedBackend: false,
    searchChargeUnit: nativeSearch ? "grounded_prompt" : null,
    reason: nativeSearch
      ? null
      : "Native research is not enabled for this provider/model. Use supplied sources or select a listed Gemini research model.",
  } as const;
}
