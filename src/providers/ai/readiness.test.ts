// @vitest-environment node
import { expect, it, vi } from "vitest";
import { probeCreationProvider } from "./readiness";
import type { AIProvider } from "./types";

function provider(generatePlan: AIProvider["generatePlan"]): AIProvider {
  return {
    id: "ollama",
    label: "Fixture",
    isConfigured: () => true,
    listModels: async () => [],
    generatePlan,
    generatePodcastPlan: vi.fn(),
    generatePodcastClipSuggestions: vi.fn(),
  };
}
it("validates the actual configured planner response and forwards cancellation and language", async () => {
  const generate = vi
    .fn()
    .mockResolvedValue({
      projectName: "Probe",
      scriptName: "Probe",
      scenes: [
        {
          text: "Review supplied content",
          templateId: "hf-statement",
          emphasis: [],
        },
      ],
    });
  const signal = new AbortController().signal;
  expect(
    await probeCreationProvider(
      provider(generate),
      "installed-model",
      "Hindi",
      signal,
    ),
  ).toMatchObject({
    modelId: "installed-model",
    language: "Hindi",
    structuredOutput: true,
  });
  expect(generate).toHaveBeenCalledWith(
    expect.objectContaining({
      modelId: "installed-model",
      sceneCount: 1,
      mediaPreference: "none",
      brief: expect.stringContaining("Hindi"),
      signal,
    }),
  );
  await expect(
    probeCreationProvider(
      provider(vi.fn().mockResolvedValue({ scenes: [] })),
      "model",
      "English",
      signal,
    ),
  ).rejects.toThrow();
});
it("does not record a late response after cancellation", async () => {
  const abort = new AbortController();
  const generate = vi.fn().mockImplementation(async () => {
    abort.abort();
    return {
      projectName: "Probe",
      scriptName: "Probe",
      scenes: [{ text: "Review", templateId: "hf-statement", emphasis: [] }],
    };
  });
  await expect(
    probeCreationProvider(
      provider(generate),
      "model",
      "Hinglish",
      abort.signal,
    ),
  ).rejects.toThrow();
});
