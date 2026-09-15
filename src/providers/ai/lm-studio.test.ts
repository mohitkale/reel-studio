import { afterEach, describe, expect, it, vi } from "vitest";

import { createLMStudioProvider } from "./lm-studio";

afterEach(() => {
  vi.unstubAllGlobals();
});

function fixtureStore(modelId = "qwen2.5-7b-instruct", token?: string) {
  return {
    readProvider: vi.fn(async () => ({
      baseUrl: "http://127.0.0.1:1234",
      modelId,
      temperature: 0.45,
      contextWindow: 16384,
      maxOutputTokens: 3072,
      allowLan: false,
      token,
    })),
    recordDiagnostic: vi.fn(async () => undefined),
  };
}

function modelsResponse() {
  return Response.json({ data: [{ id: "qwen2.5-7b-instruct" }] });
}

function completionResponse(content: unknown) {
  return Response.json({
    choices: [
      {
        message: {
          content:
            typeof content === "string" ? content : JSON.stringify(content),
        },
      },
    ],
  });
}

describe("LM Studio provider", () => {
  it("discovers /v1/models with optional local authentication", async () => {
    const fetchMock = vi.fn().mockImplementation(async () => modelsResponse());
    vi.stubGlobal("fetch", fetchMock);
    await expect(
      createLMStudioProvider(
        fixtureStore(undefined, "local-token"),
      ).listModels(),
    ).resolves.toEqual([
      { id: "qwen2.5-7b-instruct", label: "qwen2.5-7b-instruct" },
    ]);
    expect(fetchMock.mock.calls[0]![1]).toMatchObject({
      headers: { Authorization: "Bearer local-token" },
      redirect: "manual",
    });
  });

  it("generates a video plan through OpenAI-compatible schema output", async () => {
    const fetchMock = vi
      .fn()
      .mockImplementationOnce(async () => modelsResponse())
      .mockImplementationOnce(async (_url, init: RequestInit) => {
        const request = JSON.parse(String(init.body));
        expect(request).toMatchObject({
          model: "qwen2.5-7b-instruct",
          temperature: 0.45,
          max_tokens: 3072,
          response_format: { type: "json_schema" },
        });
        return completionResponse({
          projectName: "Studio reel",
          scriptName: "Local script",
          styleId: "teach-me",
          energy: "normal",
          scenes: [
            { text: "Local output", templateId: "kinetic", emphasis: [] },
          ],
        });
      });
    vi.stubGlobal("fetch", fetchMock);
    await expect(
      createLMStudioProvider(fixtureStore()).generatePlan({
        mode: "idea",
        brief: "Explain local models",
      }),
    ).resolves.toMatchObject({ projectName: "Studio reel" });
  });

  it("generates and normalizes a podcast plan", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockImplementationOnce(async () => modelsResponse())
        .mockImplementationOnce(async () =>
          completionResponse({
            title: "Studio talk",
            characters: [
              { id: "host", name: "Host", gender: "neutral" },
              { id: "guest", name: "Guest", gender: "neutral" },
            ],
            turns: [
              { characterId: "host", text: "Welcome." },
              { characterId: "guest", text: "Glad to join." },
            ],
          }),
        ),
    );
    await expect(
      createLMStudioProvider(fixtureStore()).generatePodcastPlan({
        brief: "Discuss local models",
        length: "short",
        characters: [
          { key: "host", name: "Host", gender: "neutral" },
          { key: "guest", name: "Guest", gender: "neutral" },
        ],
      }),
    ).resolves.toMatchObject({ title: "Studio talk" });
  });

  it("reports auth, offline, missing-model, and unloaded-model states", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response("denied", { status: 401 })),
    );
    await expect(
      createLMStudioProvider(fixtureStore(undefined, "wrong")).listModels(),
    ).rejects.toMatchObject({ status: 401 });

    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new Error("ECONNREFUSED")),
    );
    await expect(
      createLMStudioProvider(fixtureStore()).listModels(),
    ).rejects.toMatchObject({ status: 503 });

    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation(async () => modelsResponse()),
    );
    await expect(
      createLMStudioProvider(fixtureStore("missing-model")).generatePlan({
        mode: "idea",
        brief: "Missing model",
      }),
    ).rejects.toThrow("is not available");

    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockImplementationOnce(async () => modelsResponse())
        .mockImplementationOnce(
          async () => new Response("model is not loaded", { status: 503 }),
        ),
    );
    await expect(
      createLMStudioProvider(fixtureStore()).generatePlan({
        mode: "idea",
        brief: "Unloaded model",
      }),
    ).rejects.toThrow("unloaded or unavailable");
  });

  it("rejects malformed JSON and schema mismatches", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockImplementationOnce(async () => modelsResponse())
        .mockImplementationOnce(async () => completionResponse("not-json")),
    );
    await expect(
      createLMStudioProvider(fixtureStore()).generatePlan({
        mode: "idea",
        brief: "Malformed",
      }),
    ).rejects.toThrow("malformed JSON");

    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockImplementationOnce(async () => modelsResponse())
        .mockImplementationOnce(async () =>
          completionResponse({
            projectName: "Bad",
            scriptName: "Bad",
            scenes: [{ text: "Bad", templateId: "made-up", emphasis: [] }],
          }),
        ),
    );
    await expect(
      createLMStudioProvider(fixtureStore()).generatePlan({
        mode: "idea",
        brief: "Schema mismatch",
      }),
    ).rejects.toThrow();
  });

  it("preserves request cancellation", async () => {
    const controller = new AbortController();
    controller.abort();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new DOMException("aborted", "AbortError")),
    );
    await expect(
      createLMStudioProvider(fixtureStore()).generatePlan({
        mode: "idea",
        brief: "Cancel",
        signal: controller.signal,
      }),
    ).rejects.toMatchObject({ status: 499 });
  });
});
