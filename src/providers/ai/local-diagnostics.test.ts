import { afterEach, describe, expect, it, vi } from "vitest";

import { diagnoseLocalAIProvider } from "./local-diagnostics";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("local AI diagnostics", () => {
  it("distinguishes healthy, missing-model, and offline states", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockImplementation(async () =>
          Response.json({ models: [{ name: "qwen2.5:7b" }] }),
        ),
    );
    await expect(
      diagnoseLocalAIProvider("ollama", {
        baseUrl: "http://127.0.0.1:11434",
        modelId: "qwen2.5:7b",
        allowLan: false,
      }),
    ).resolves.toMatchObject({ state: "healthy", modelIds: ["qwen2.5:7b"] });
    await expect(
      diagnoseLocalAIProvider("ollama", {
        baseUrl: "http://127.0.0.1:11434",
        modelId: "missing",
        allowLan: false,
      }),
    ).resolves.toMatchObject({ state: "missing-model" });

    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("refused")));
    await expect(
      diagnoseLocalAIProvider("lm-studio", {
        baseUrl: "http://127.0.0.1:1234",
        modelId: "",
        allowLan: false,
      }),
    ).resolves.toMatchObject({ state: "offline" });
  });

  it("uses an LM Studio token only for LM Studio discovery", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(Response.json({ data: [{ id: "local-model" }] }));
    vi.stubGlobal("fetch", fetchMock);
    await diagnoseLocalAIProvider("lm-studio", {
      baseUrl: "http://127.0.0.1:1234",
      modelId: "local-model",
      allowLan: false,
      token: "lm-secret",
    });
    expect(fetchMock).toHaveBeenCalledWith(
      expect.any(URL),
      expect.objectContaining({
        headers: { Authorization: "Bearer lm-secret" },
      }),
    );
  });
});
