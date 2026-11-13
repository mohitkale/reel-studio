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
    // POSIX mode bits do not represent NTFS ACLs. Windows protection is inherited
    // from the user-owned directory; do not claim chmod enforces its ACL.
    if (process.platform !== "win32")
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
      expect.objectContaining({ id: "llama-cpp", modelId: "" }),
    ]);

    await expect(store.list()).resolves.toEqual([
      expect.objectContaining({ id: "ollama", modelId: "qwen2.5:7b" }),
      expect.objectContaining({
        id: "lm-studio",
        modelId: "qwen2.5-7b-instruct",
      }),
      expect.objectContaining({ id: "llama-cpp", modelId: "" }),
    ]);
  });
});

it("keeps a successful planning probe across restart and invalidates changed settings", async () => {
  const directory = await mkdtemp(path.join(tmpdir(), "reel-readiness-"));
  const filename = path.join(directory, "config.json");
  const store = createLocalAIConfigStore(filename);
  const config = {
    baseUrl: "http://127.0.0.1:11434",
    modelId: "fixture",
    temperature: 0.3,
    allowLan: false,
  };
  await store.save("ollama", config);
  const probe = {
    modelId: "fixture",
    checkedAt: new Date().toISOString(),
    latencyMs: 100,
    language: "English" as const,
    structuredOutput: true,
  };
  await store.recordGenerationProbe("ollama", probe, config);
  const restarted = createLocalAIConfigStore(filename);
  expect((await restarted.list())[0].generationProbe).toEqual(probe);
  await restarted.save("ollama", { ...config, temperature: 0.4 });
  expect((await restarted.list())[0].generationProbe).toBeUndefined();
  await store.recordGenerationProbe("ollama", probe, config);
  expect((await restarted.list())[0].generationProbe).toBeUndefined();
});
