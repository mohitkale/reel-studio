import { z } from "zod";
import { researchCapability } from "./capabilities";

export const researchCapabilityViewSchema = z.object({
  version: z.literal(1),
  defaultResearchModel: z.string(),
  configured: z.boolean(),
  defaultResearchModels: z.object({ gemini: z.string(), openai: z.string() }),
  configuredProviders: z.object({ gemini: z.boolean(), openai: z.boolean() }),
  capabilities: z
    .array(
      z.object({
        providerId: z.string(),
        modelId: z.string(),
        nativeSearch: z.boolean(),
        urlContext: z.boolean(),
        endpoint: z.string().nullable(),
        suppliedSources: z.boolean(),
        sharedBackend: z.boolean(),
        searchChargeUnit: z
          .enum(["grounded_prompt", "web_search_call"])
          .nullable(),
        reason: z.string().nullable(),
      }),
    )
    .max(100),
  writers: z
    .array(
      z.object({
        id: z.enum(["gemini", "openai", "ollama", "lm-studio", "llama-cpp"]),
        label: z.string(),
        kind: z.enum(["cloud", "local"]),
        configured: z.boolean(),
        defaultModel: z.string(),
      }),
    )
    .max(5),
  bounds: z.object({
    maxProviderCalls: z.literal(1),
    maxSearchChargeUnits: z.literal(1),
    searchChargeUnits: z.array(z.enum(["grounded_prompt", "web_search_call"])),
    maxUrls: z.literal(5),
    maxSources: z.literal(5),
    maxDeadlineMs: z.literal(45_000),
    maxResponseBytes: z.literal(1_000_000),
    maxOutputTokens: z.literal(4096),
    maxLocalWriterCalls: z.literal(1),
    maxWriterContextChars: z.literal(24_000),
  }),
});
export type ResearchCapabilityView = z.infer<
  typeof researchCapabilityViewSchema
>;

export interface ResearchReadinessSelection {
  mode: "supplied" | "web";
  writerProviderId: string;
  writerModelId: string;
  researcherProviderId: string;
  researcherModelId: string;
}

/** Configuration checks only. Model discovery and key presence do not prove support. */
export function researchReadiness(
  selection: ResearchReadinessSelection,
  view: ResearchCapabilityView,
) {
  const issues: string[] = [];
  const writer = view.writers.find(
    (item) => item.id === selection.writerProviderId,
  );
  if (!writer?.configured)
    issues.push(
      `Configure ${writer?.label ?? "the selected writer"} in Settings before writing a draft.`,
    );
  if (!selection.writerModelId.trim())
    issues.push("Choose an explicit writer model.");
  const writerCapability = researchCapability(
    selection.writerProviderId,
    selection.writerModelId,
  );
  const researcherCapability = researchCapability(
    selection.researcherProviderId,
    selection.researcherModelId,
  );
  if (selection.mode === "web") {
    if (!["gemini", "openai"].includes(selection.researcherProviderId))
      issues.push(
        "Select Gemini or OpenAI explicitly as the researcher. A local writer does not search by itself.",
      );
    else {
      const provider = selection.researcherProviderId as "gemini" | "openai";
      if (!view.configuredProviders[provider])
        issues.push(
          `Add the ${provider === "gemini" ? "Gemini" : "OpenAI"} API key, or choose Sources only.`,
        );
      if (!researcherCapability.nativeSearch)
        issues.push(
          "This researcher/model combination is unsupported. Choose a listed research model; model discovery does not establish search support.",
        );
    }
  }
  return {
    ready: !issues.length,
    issues,
    writerCapability,
    researcherCapability,
    cloudResearch: selection.mode === "web",
    localWriter: writer?.kind === "local",
  };
}
