import http from "node:http";
import type { AddressInfo } from "node:net";
import { afterEach, describe, expect, it } from "vitest";

import { pullOllamaModel, type PullProgress } from "./ollama-pull";

let server: http.Server | undefined;
afterEach(() => {
  server?.close();
  server = undefined;
});

/** A fake Ollama that streams the given lines from /api/pull. */
async function fakeOllama(lines: string[]): Promise<string> {
  server = http.createServer((req, res) => {
    req.resume();
    req.on("end", () => {
      res.setHeader("content-type", "application/x-ndjson");
      res.end(lines.map((line) => `${line}\n`).join(""));
    });
  });
  await new Promise<void>((resolve) => server!.listen(0, "127.0.0.1", resolve));
  return `http://127.0.0.1:${(server!.address() as AddressInfo).port}`;
}

describe("pulling a model through Ollama", () => {
  it("reports progress and finishes on success", async () => {
    const baseUrl = await fakeOllama([
      JSON.stringify({ status: "pulling manifest" }),
      JSON.stringify({ status: "pulling abc", total: 200, completed: 50 }),
      JSON.stringify({ status: "pulling abc", total: 200, completed: 200 }),
      JSON.stringify({ status: "success" }),
    ]);
    const seen: PullProgress[] = [];
    await pullOllamaModel({
      baseUrl,
      model: "qwen2.5:3b",
      onProgress: (p) => seen.push(p),
    });
    expect(seen.map((p) => p.fraction)).toEqual([
      undefined,
      0.25,
      1,
      undefined,
    ]);
    expect(seen.at(-1)!.status).toBe("success");
  });

  it("raises the error Ollama reports", async () => {
    const baseUrl = await fakeOllama([
      JSON.stringify({ error: "pull model manifest: file does not exist" }),
    ]);
    await expect(
      pullOllamaModel({ baseUrl, model: "nope", onProgress: () => {} }),
    ).rejects.toThrow(/does not exist/);
  });

  it("fails when the stream ends before success", async () => {
    const baseUrl = await fakeOllama([
      JSON.stringify({ status: "pulling abc", total: 10, completed: 1 }),
    ]);
    await expect(
      pullOllamaModel({ baseUrl, model: "m", onProgress: () => {} }),
    ).rejects.toThrow(/ended before it finished/);
  });

  it("refuses a server that is not on this network", async () => {
    await expect(
      pullOllamaModel({
        baseUrl: "http://8.8.8.8:11434",
        model: "m",
        onProgress: () => {},
      }),
    ).rejects.toThrow();
  });
});
