import { afterEach, describe, expect, it, vi } from "vitest";

import { createGeminiProvider, GEMINI_DEFAULT_MODEL } from "./gemini";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("Gemini provider regression", () => {
  it("preserves structured video planning and request cancellation", async () => {
    vi.stubEnv("GEMINI_API_KEY", "gemini-secret");
    const controller = new AbortController();
    const fetchMock = vi.fn().mockResolvedValue(
      Response.json({
        candidates: [
          {
            content: {
              parts: [
                {
                  text: JSON.stringify({
                    projectName: "Project",
                    scriptName: "Script",
                    styleId: "bold-hook",
                    energy: "high",
                    scenes: [
                      {
                        text: "Hello",
                        templateId: "kinetic",
                        emphasis: [],
                      },
                    ],
                  }),
                },
              ],
            },
          },
        ],
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      createGeminiProvider().generatePlan({
        mode: "idea",
        brief: "A test",
        signal: controller.signal,
      }),
    ).resolves.toMatchObject({ projectName: "Project" });

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_DEFAULT_MODEL}:generateContent`,
    );
    expect(init.signal).toBe(controller.signal);
    expect(init.headers).toMatchObject({
      "x-goog-api-key": "gemini-secret",
      "content-type": "application/json",
    });
    expect(JSON.parse(String(init.body))).toMatchObject({
      generationConfig: {
        responseMimeType: "application/json",
        temperature: 0.85,
      },
    });
  });
});
