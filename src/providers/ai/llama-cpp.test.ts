// @vitest-environment node
import { createServer } from "node:http";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { z } from "zod";
import { expect, it } from "vitest";
import { createLocalAIConfigStore } from "@/server/local-ai-config";
import { createLocalCompatibleProvider } from "./lm-studio";
import { AI_PROVIDER_IDS, aiProviderStatusSchema } from "./types";
import { getAIProvider } from "./registry";

it("registers llama.cpp and completes video, podcast and clip plans over guarded local HTTP", async () => {
  const directory = await mkdtemp(path.join(tmpdir(), "reel-llama-test-"));
  const store = createLocalAIConfigStore(path.join(directory, "config.json"));
  const paths: string[] = [];
  const completions: unknown[] = [];
  const requestSchema = z.object({
    model: z.string(),
    temperature: z.number(),
    max_tokens: z.number(),
    response_format: z.object({
      json_schema: z.object({
        schema: z.object({ properties: z.record(z.string(), z.unknown()) }),
      }),
    }),
  });
  const server = createServer(async (req, res) => {
    paths.push(req.url!);
    res.setHeader("content-type", "application/json");
    if (req.headers.authorization !== "Bearer fixture-token") {
      res.statusCode = 401;
      res.end("{}");
      return;
    }
    if (req.url === "/v1/models") {
      res.end(JSON.stringify({ data: [{ id: "fixture-model" }] }));
      return;
    }
    let body = "";
    for await (const chunk of req) body += chunk;
    try {
      const parsed = requestSchema.parse(JSON.parse(body));
      completions.push(parsed);
      const fields = parsed.response_format.json_schema.schema.properties;
      const content = fields.scenes
        ? {
            projectName: "Local fixture",
            scriptName: "Supplied copy",
            styleId: "teach-me",
            energy: "normal",
            scenes: [
              {
                capabilityId: "hf.template.statement",
                text: "Keep the supplied copy.",
                emphasis: [],
              },
            ],
          }
        : fields.turns
          ? {
              title: "Local discussion",
              characters: [
                { id: "host", name: "Host", gender: "neutral" },
                { id: "guest", name: "Guest", gender: "neutral" },
              ],
              turns: [
                { characterId: "host", text: "Welcome." },
                { characterId: "guest", text: "Thank you." },
              ],
            }
          : {
              suggestions: [
                {
                  startTurnId: "turn-1",
                  endTurnId: "turn-2",
                  label: "Opening",
                  reason: "Supplied opening turns.",
                },
              ],
            };
      res.end(
        JSON.stringify({
          choices: [{ message: { content: JSON.stringify(content) } }],
        }),
      );
    } catch {
      res.statusCode = 400;
      res.end("{}");
    }
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string")
    throw new Error("No fixture port");
  try {
    await store.save("llama-cpp", {
      baseUrl: `http://127.0.0.1:${address.port}`,
      modelId: "fixture-model",
      temperature: 0.4,
      maxOutputTokens: 1024,
      allowLan: false,
      token: "fixture-token",
    });
    expect(AI_PROVIDER_IDS).toContain("llama-cpp");
    expect(getAIProvider("llama-cpp")).toMatchObject({
      id: "llama-cpp",
      label: "llama.cpp",
    });
    expect(
      aiProviderStatusSchema.parse({
        id: "llama-cpp",
        kind: "local",
        label: "llama.cpp",
        configured: true,
        defaultModel: "fixture-model",
      }).id,
    ).toBe("llama-cpp");
    expect(
      (await store.list()).find((view) => view.id === "llama-cpp"),
    ).not.toHaveProperty("token");
    const provider = createLocalCompatibleProvider("llama-cpp", store);
    expect(await provider.listModels()).toEqual([
      { id: "fixture-model", label: "fixture-model" },
    ]);
    expect(
      await provider.generatePlan({
        mode: "story",
        brief: "Keep the supplied copy.",
      }),
    ).toMatchObject({ scenes: [{ text: "Keep the supplied copy." }] });
    expect(
      await provider.generatePodcastPlan({
        brief: "Local discussion",
        length: "short",
        characters: [
          { key: "host", name: "Host", gender: "neutral" },
          { key: "guest", name: "Guest", gender: "neutral" },
        ],
      }),
    ).toMatchObject({ title: "Local discussion" });
    expect(
      await provider.generatePodcastClipSuggestions({
        title: "Local discussion",
        fps: 30,
        timeline: [
          {
            turnId: "turn-1",
            startFrame: 0,
            durationFrames: 30,
            text: "Welcome.",
          },
          {
            turnId: "turn-2",
            startFrame: 30,
            durationFrames: 30,
            text: "Thank you.",
          },
        ],
      }),
    ).toEqual([
      {
        startTurnId: "turn-1",
        endTurnId: "turn-2",
        label: "Opening",
        reason: "Supplied opening turns.",
      },
    ]);
    expect(completions).toHaveLength(3);
    expect(completions[0]).toMatchObject({
      model: "fixture-model",
      temperature: 0.4,
      max_tokens: 1024,
    });
    expect(
      paths.every(
        (url) => url === "/v1/models" || url === "/v1/chat/completions",
      ),
    ).toBe(true);
    const canceled = new AbortController();
    canceled.abort();
    await expect(
      provider.generatePlan({
        mode: "idea",
        brief: "Canceled fixture",
        signal: canceled.signal,
      }),
    ).rejects.toMatchObject({ status: 499 });
    await store.save("llama-cpp", {
      baseUrl: `http://127.0.0.1:${address.port}`,
      modelId: "fixture-model",
      temperature: 0.4,
      allowLan: false,
      token: "",
    });
    await expect(provider.listModels()).rejects.toMatchObject({
      status: 401,
      providerId: "llama-cpp",
    });
  } finally {
    server.closeAllConnections();
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await rm(directory, { recursive: true, force: true });
  }
}, 20000);
