import { afterEach, describe, expect, it, vi } from "vitest";

import { listAIProviderStatuses } from "./registry";

vi.mock("@/server/local-ai-config", () => ({
  localAIConfigStore: {
    readProvider: vi.fn(async () => ({ modelId: "" })),
  },
}));

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("AI provider status", () => {
  it("does not contact optional local servers during startup discovery", async () => {
    vi.stubEnv("GEMINI_API_KEY", "configured-gemini-key");
    vi.stubEnv("OPENAI_API_KEY", "configured-openai-key");
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await expect(listAIProviderStatuses()).resolves.toEqual([
      expect.objectContaining({
        id: "gemini",
        kind: "cloud",
        configured: true,
      }),
      expect.objectContaining({
        id: "openai",
        kind: "cloud",
        configured: true,
      }),
      expect.objectContaining({
        id: "ollama",
        kind: "local",
        configured: false,
      }),
      expect.objectContaining({
        id: "lm-studio",
        kind: "local",
        configured: false,
      }),
    ]);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
