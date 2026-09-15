import { mkdtemp, readFile, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { createLocalAIConfigStore } from "./local-ai-config";

describe("local AI config store", () => {
  it("persists bounded settings and keeps the token out of client views", async () => {
    const directory = await mkdtemp(path.join(tmpdir(), "reel-local-ai-"));
    const file = path.join(directory, "config.json");
    const store = createLocalAIConfigStore(file);
    const view = await store.save("lm-studio", {
      baseUrl: "http://127.0.0.1:1234/",
      modelId: "qwen2.5-7b-instruct",
      temperature: 0.4,
      contextWindow: 16384,
      maxOutputTokens: 4096,
      allowLan: false,
      token: "local-secret",
    });

    expect(view).toMatchObject({
      baseUrl: "http://127.0.0.1:1234",
      hasToken: true,
      endpointScope: "loopback",
    });
    expect(view).not.toHaveProperty("token");
    expect(await readFile(file, "utf8")).toContain("local-secret");
    expect((await stat(file)).mode & 0o777).toBe(0o600);
  });

  it("rejects settings outside the supported model bounds", async () => {
    const directory = await mkdtemp(path.join(tmpdir(), "reel-local-ai-"));
    const store = createLocalAIConfigStore(path.join(directory, "config.json"));
    await expect(
      store.save("ollama", {
        baseUrl: "http://127.0.0.1:11434",
        modelId: "tiny",
        temperature: 3,
        contextWindow: 128,
        maxOutputTokens: 1_000_000,
        allowLan: false,
      }),
    ).rejects.toThrow();
  });

  it("serializes concurrent provider updates without losing either provider", async () => {
    const directory = await mkdtemp(path.join(tmpdir(), "reel-local-ai-"));
    const store = createLocalAIConfigStore(path.join(directory, "config.json"));

    await Promise.all([
      store.save("ollama", {
        baseUrl: "http://127.0.0.1:11434",
        modelId: "qwen2.5:7b",
        temperature: 0.3,
        allowLan: false,
      }),
      store.save("lm-studio", {
        baseUrl: "http://127.0.0.1:1234",
        modelId: "qwen2.5-7b-instruct",
        temperature: 0.4,
        allowLan: false,
      }),
    ]);

    await expect(store.list()).resolves.toEqual([
      expect.objectContaining({ id: "ollama", modelId: "qwen2.5:7b" }),
      expect.objectContaining({
        id: "lm-studio",
        modelId: "qwen2.5-7b-instruct",
      }),
    ]);
  });
});
