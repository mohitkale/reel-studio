import { afterEach, describe, expect, it, vi } from "vitest";

import { createOllamaProvider } from "./ollama";

afterEach(() => {
  vi.unstubAllGlobals();
});

function fixtureStore(modelId = "qwen2.5:7b") {
  return {
    readProvider: vi.fn(async () => ({
      baseUrl: "http://127.0.0.1:11434",
      modelId,
      temperature: 0.35,
      contextWindow: 16384,
      maxOutputTokens: 2048,
      allowLan: false,
    })),
    recordDiagnostic: vi.fn(async () => undefined),
  };
}

function modelsResponse() {
  return Response.json({
    models: [{ name: "qwen2.5:7b", model: "qwen2.5:7b" }],
  });
}

function chatResponse(content: unknown, init?: ResponseInit) {
  return Response.json(
    {
      message: {
        content:
          typeof content === "string" ? content : JSON.stringify(content),
      },
    },
    init,
  );
}

describe("Ollama provider", () => {
  it("discovers native Ollama models and records diagnostics", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation(async () => modelsResponse()),
    );
    const store = fixtureStore();
    await expect(createOllamaProvider(store).listModels()).resolves.toEqual([
      { id: "qwen2.5:7b", label: "qwen2.5:7b" },
    ]);
    expect(store.recordDiagnostic).toHaveBeenCalledWith(
      "ollama",
      expect.objectContaining({ state: "healthy" }),
    );
  });

  it("generates a strictly validated video plan with native schema output", async () => {
    const fetchMock = vi
      .fn()
      .mockImplementationOnce(async () => modelsResponse())
      .mockImplementationOnce(async (_url, init: RequestInit) => {
        const request = JSON.parse(String(init.body));
        expect(request).toMatchObject({
          model: "qwen2.5:7b",
          stream: false,
          options: { temperature: 0.35, num_ctx: 16384, num_predict: 2048 },
        });
        expect(request.format.type).toBe("object");
        return chatResponse({
          projectName: "Local reel",
          scriptName: "Local script",
          styleId: "clean-story",
          energy: "normal",
          scenes: [
            { text: "A local plan", templateId: "kinetic", emphasis: [] },
          ],
        });
      });
    vi.stubGlobal("fetch", fetchMock);
    await expect(
      createOllamaProvider(fixtureStore()).generatePlan({
        mode: "idea",
        brief: "Explain local AI",
      }),
    ).resolves.toMatchObject({ projectName: "Local reel" });
  });

  it("generates and normalizes a podcast plan", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockImplementationOnce(async () => modelsResponse())
        .mockImplementationOnce(async () =>
          chatResponse({
            title: "Local voices",
            characters: [
              { id: "host", name: "Host", gender: "neutral" },
              { id: "guest", name: "Guest", gender: "neutral" },
            ],
            turns: [
              { characterId: "host", text: "Welcome." },
              { characterId: "guest", text: "Thanks." },
            ],
          }),
        ),
    );
    await expect(
      createOllamaProvider(fixtureStore()).generatePodcastPlan({
        brief: "A local AI discussion",
        length: "short",
        characters: [
          { key: "host", name: "Host", gender: "neutral" },
          { key: "guest", name: "Guest", gender: "neutral" },
        ],
      }),
    ).resolves.toMatchObject({
      title: "Local voices",
      turns: [{ characterId: "host" }, { characterId: "guest" }],
    });
  });

  it("reports offline, missing, and unloaded models actionably", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new Error("ECONNREFUSED")),
    );
    await expect(
      createOllamaProvider(fixtureStore()).listModels(),
    ).rejects.toMatchObject({
      status: 503,
      providerId: "ollama",
    });

    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation(async () => modelsResponse()),
    );
    await expect(
      createOllamaProvider(fixtureStore("other:7b")).generatePlan({
        mode: "idea",
        brief: "Missing model",
      }),
    ).rejects.toThrow("is not installed");

    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockImplementationOnce(async () => modelsResponse())
        .mockImplementationOnce(
          async () =>
            new Response('{"error":"runner failed to load model"}', {
              status: 503,
            }),
        ),
    );
    await expect(
      createOllamaProvider(fixtureStore()).generatePlan({
        mode: "idea",
        brief: "Unloaded model",
      }),
    ).rejects.toThrow("could not be loaded");
  });

  it("preserves cancellation and rejects malformed or schema-invalid output", async () => {
    const controller = new AbortController();
    controller.abort();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new DOMException("aborted", "AbortError")),
    );
    await expect(
      createOllamaProvider(fixtureStore()).generatePlan({
        mode: "idea",
        brief: "Cancel",
        signal: controller.signal,
      }),
    ).rejects.toMatchObject({ status: 499 });

    const malformedFetch = vi
      .fn()
      .mockImplementationOnce(async () => modelsResponse())
      .mockImplementationOnce(async () => chatResponse("not-json"))
      .mockImplementationOnce(async () => modelsResponse())
      .mockImplementationOnce(async () => chatResponse("still-not-json"));
    vi.stubGlobal("fetch", malformedFetch);
    await expect(
      createOllamaProvider(fixtureStore()).generatePlan({
        mode: "idea",
        brief: "Malformed",
      }),
    ).rejects.toThrow("repair was exhausted after one attempt");
    expect(
      malformedFetch.mock.calls.filter(
        ([url]) => new URL(String(url)).pathname === "/api/chat",
      ),
    ).toHaveLength(2);

    const invalidPlan = {
      projectName: "Bad",
      scriptName: "Bad",
      scenes: [{ text: "Bad", templateId: "invented-template", emphasis: [] }],
    };
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockImplementationOnce(async () => modelsResponse())
        .mockImplementationOnce(async () => chatResponse(invalidPlan))
        .mockImplementationOnce(async () => modelsResponse())
        .mockImplementationOnce(async () => chatResponse(invalidPlan)),
    );
    await expect(
      createOllamaProvider(fixtureStore()).generatePlan({
        mode: "idea",
        brief: "Schema mismatch",
      }),
    ).rejects.toThrow("repair was exhausted after one attempt");
  });

  it("makes one repair request to the same selected model", async () => {
    const repaired = {
      projectName: "Repaired",
      scriptName: "Repaired",
      styleId: "clean-story",
      energy: "normal",
      scenes: [{ text: "Valid", templateId: "kinetic", emphasis: [] }],
    };
    const fetchMock = vi
      .fn()
      .mockImplementationOnce(async () => modelsResponse())
      .mockImplementationOnce(async () => chatResponse("prose before JSON"))
      .mockImplementationOnce(async () => modelsResponse())
      .mockImplementationOnce(async () => chatResponse(repaired));
    vi.stubGlobal("fetch", fetchMock);
    await expect(
      createOllamaProvider(fixtureStore()).generatePlan({
        mode: "idea",
        brief: "Repair once",
      }),
    ).resolves.toMatchObject({ projectName: "Repaired" });
    const modelRequests = fetchMock.mock.calls
      .filter(([url]) => new URL(String(url)).pathname === "/api/chat")
      .map(([, init]) => JSON.parse(String((init as RequestInit).body)).model);
    expect(modelRequests).toEqual(["qwen2.5:7b", "qwen2.5:7b"]);
  });
});
