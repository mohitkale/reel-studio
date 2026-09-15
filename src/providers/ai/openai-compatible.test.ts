import { afterEach, describe, expect, it, vi } from "vitest";

import { createOpenAIProvider } from "./openai";
import {
  createLocalOpenAICompatibleTransport,
  createOpenAICloudTransport,
} from "./openai-compatible";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

const schema = {
  name: "fixture",
  strict: true,
  schema: { type: "object", additionalProperties: false },
};

describe("OpenAI-compatible structured transport", () => {
  it("preserves OpenAI structured-output request behavior", async () => {
    vi.stubEnv("OPENAI_API_KEY", "cloud-secret");
    const fetchMock = vi.fn().mockResolvedValue(
      Response.json({
        choices: [
          {
            message: {
              content: JSON.stringify({
                projectName: "Project",
                scriptName: "Script",
                styleId: "bold-hook",
                energy: "high",
                scenes: [
                  { text: "Hello", templateId: "kinetic", emphasis: [] },
                ],
              }),
            },
          },
        ],
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      createOpenAIProvider().generatePlan({ mode: "idea", brief: "A test" }),
    ).resolves.toMatchObject({ projectName: "Project" });
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.openai.com/v1/chat/completions");
    expect(init.headers).toMatchObject({
      Authorization: "Bearer cloud-secret",
      "content-type": "application/json",
    });
    expect(JSON.parse(String(init.body))).toMatchObject({
      response_format: { type: "json_schema" },
    });
  });

  it("never reads or forwards cloud credentials to a local endpoint", async () => {
    vi.stubEnv("OPENAI_API_KEY", "must-not-leak");
    vi.stubEnv("GEMINI_API_KEY", "must-not-leak-either");
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        Response.json({ choices: [{ message: { content: "{}" } }] }),
      );
    vi.stubGlobal("fetch", fetchMock);
    const transport = createLocalOpenAICompatibleTransport({
      providerId: "lm-studio",
      label: "LM Studio",
      baseUrl: "http://127.0.0.1:1234",
      allowLan: false,
    });
    await transport.complete({
      model: "local",
      temperature: 0.2,
      system: "system",
      user: "user",
      jsonSchema: schema,
    });
    const init = fetchMock.mock.calls[0]![1] as RequestInit;
    expect(init.headers).toEqual({ "content-type": "application/json" });
    expect(JSON.stringify(init)).not.toContain("must-not-leak");
  });

  it("forwards only an explicitly supplied local token", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        Response.json({ choices: [{ message: { content: "{}" } }] }),
      );
    vi.stubGlobal("fetch", fetchMock);
    const transport = createLocalOpenAICompatibleTransport({
      providerId: "lm-studio",
      label: "LM Studio",
      baseUrl: "http://127.0.0.1:1234",
      allowLan: false,
      token: "local-only",
    });
    await transport.complete({
      model: "local",
      temperature: 0.2,
      system: "system",
      user: "user",
      jsonSchema: schema,
    });
    expect(fetchMock.mock.calls[0]![1]).toMatchObject({
      headers: {
        Authorization: "Bearer local-only",
        "content-type": "application/json",
      },
    });
  });

  it("validates compatible response envelopes", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(Response.json({ bad: true })),
    );
    await expect(
      createOpenAICloudTransport(() => "key").complete({
        model: "gpt-fixture",
        temperature: 0,
        system: "system",
        user: "user",
        jsonSchema: schema,
      }),
    ).rejects.toThrow("empty response");
  });
});
