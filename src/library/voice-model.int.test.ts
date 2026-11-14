import { createHash } from "node:crypto";
import { mkdtempSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { createServer, type Server } from "node:http";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { KOKORO_MODEL_ID } from "@/providers/voice/kokoro";
import {
  downloadVoiceModel,
  getVoiceModelStatus,
  KOKORO_MODEL_FILES,
} from "./voice-model";

const FILES = Object.fromEntries(
  KOKORO_MODEL_FILES.map((f, i) => [f, Buffer.alloc(40_000 + i * 1000, i + 1)]),
);
let server: Server | undefined;
afterEach(() => server?.close());

function host(options: { failOnceAfter?: number; wrongHash?: boolean } = {}) {
  let failed = false;
  const requests: Array<{ url: string; range?: string }> = [];
  server = createServer((req, res) => {
    const url = req.url ?? "";
    requests.push({ url, range: req.headers.range });
    if (url.startsWith(`/api/models/${KOKORO_MODEL_ID}/tree`)) {
      res.setHeader("content-type", "application/json");
      res.end(
        JSON.stringify(
          Object.entries(FILES).map(([p, data]) => ({
            path: p,
            size: data.length,
            lfs: {
              oid: options.wrongHash
                ? "0".repeat(64)
                : createHash("sha256").update(data).digest("hex"),
              size: data.length,
            },
          })),
        ),
      );
      return;
    }
    const file = Object.keys(FILES).find((p) =>
      url.endsWith(`/resolve/main/${p}`),
    );
    if (!file) return void res.writeHead(404).end();
    const data = FILES[file]!;
    const range = /bytes=(\d+)-/.exec(req.headers.range ?? "");
    const start = range ? Number(range[1]) : 0;
    const chunk = data.subarray(start);
    res.writeHead(range ? 206 : 200, { "content-length": chunk.length });
    if (options.failOnceAfter && !failed && file === "tokenizer.json") {
      failed = true;
      res.write(chunk.subarray(0, options.failOnceAfter));
      setTimeout(() => res.destroy(), 5);
      return;
    }
    res.end(chunk);
  });
  return new Promise<{ url: string; requests: typeof requests }>((resolve) =>
    server!.listen(0, "127.0.0.1", () => {
      const { port } = server!.address() as { port: number };
      resolve({ url: `http://127.0.0.1:${port}`, requests });
    }),
  );
}

describe("guided voice model download", () => {
  it("downloads, verifies and reports progress", async () => {
    const { url } = await host();
    const cacheDir = mkdtempSync(path.join(tmpdir(), "vm-"));
    expect((await getVoiceModelStatus(cacheDir)).cached).toBe(false);
    const seen: number[] = [];
    const status = await downloadVoiceModel({
      cacheDir,
      host: url,
      onProgress: (p) => seen.push(p.bytesDone / p.bytesTotal),
    });
    expect(status.cached).toBe(true);
    expect(readFileSync(path.join(cacheDir, "tokenizer.json"))).toEqual(
      FILES["tokenizer.json"],
    );
    expect(seen.at(-1)).toBeCloseTo(1, 2);
  });

  it("resumes an interrupted download with a Range request", async () => {
    const { url, requests } = await host({ failOnceAfter: 10_000 });
    const cacheDir = mkdtempSync(path.join(tmpdir(), "vm-"));
    await expect(downloadVoiceModel({ cacheDir, host: url })).rejects.toThrow();
    expect(existsSync(path.join(cacheDir, "tokenizer.json.part"))).toBe(true);
    const status = await downloadVoiceModel({ cacheDir, host: url });
    expect(status.cached).toBe(true);
    expect(requests.some((r) => r.range?.startsWith("bytes="))).toBe(true);
  });

  it("does not download again once cached", async () => {
    const { url, requests } = await host();
    const cacheDir = mkdtempSync(path.join(tmpdir(), "vm-"));
    await downloadVoiceModel({ cacheDir, host: url });
    const before = requests.filter((r) => r.url.includes("/resolve/")).length;
    await downloadVoiceModel({ cacheDir, host: url });
    expect(requests.filter((r) => r.url.includes("/resolve/")).length).toBe(
      before,
    );
  });

  it("refuses a file that does not match the published checksum", async () => {
    const { url } = await host({ wrongHash: true });
    const cacheDir = mkdtempSync(path.join(tmpdir(), "vm-"));
    await expect(downloadVoiceModel({ cacheDir, host: url })).rejects.toThrow(
      /checksum/,
    );
    writeFileSync(path.join(cacheDir, "x"), "");
    expect((await getVoiceModelStatus(cacheDir)).cached).toBe(false);
  });
});
