// @vitest-environment node
import { PassThrough } from "node:stream";
import type { IncomingMessage } from "node:http";
import { mkdtemp, readFile, rm, access } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { downloadPublicMediaToFile } from "./public-media-download";
const publicDns = async () => [{ address: "93.184.216.34", family: 4 }];
const png = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==",
  "base64",
);
function response(
  status = 200,
  headers: Record<string, string> = { "content-type": "image/png" },
  body: string | Buffer | null = png,
) {
  const stream = Object.assign(new PassThrough(), {
    statusCode: status,
    headers,
  });
  if (body !== null) stream.end(body);
  return stream as unknown as IncomingMessage;
}
let dir: string, file: string;
beforeEach(async () => {
  dir = await mkdtemp(path.join(tmpdir(), "reel-public-media-"));
  file = path.join(dir, "asset.tmp");
});
afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});
describe("render media threat boundary", () => {
  it.each([
    "http://127.0.0.1/x",
    "http://[::ffff:7f00:1]/x",
    "file:///secret",
    "https://u:p@example.com/x",
    "https://example.com:8080/x",
  ])("rejects unsafe URLs before transport: %s", async (url) => {
    const request = vi.fn();
    await expect(
      downloadPublicMediaToFile(url, file, { resolveHost: publicDns, request }),
    ).rejects.toThrow();
    expect(request).not.toHaveBeenCalled();
  });
  it("rejects nip.io aliases and mixed public/private DNS answers", async () => {
    const request = vi.fn();
    for (const addresses of [
      [{ address: "127.0.0.1", family: 4 }],
      [...(await publicDns()), { address: "::ffff:a00:1", family: 6 }],
    ])
      await expect(
        downloadPublicMediaToFile("https://127.0.0.1.nip.io/x", file, {
          resolveHost: async () => addresses,
          request,
        }),
      ).rejects.toThrow(/private/i);
    expect(request).not.toHaveBeenCalled();
  });
  it("checks the DNS answers used by the socket, rejecting rebinding", async () => {
    const resolveHost = vi
      .fn()
      .mockResolvedValueOnce(await publicDns())
      .mockResolvedValueOnce([{ address: "10.0.0.1", family: 4 }]);
    await expect(
      downloadPublicMediaToFile("https://example.com/image", file, {
        resolveHost,
        request: async (url, opts) => {
          await new Promise<void>((resolve, reject) =>
            opts.lookup(url.hostname, { all: true }, (error) =>
              error ? reject(error) : resolve(),
            ),
          );
          return response();
        },
      }),
    ).rejects.toThrow(/private/i);
    expect(resolveHost).toHaveBeenCalledTimes(2);
    await expect(access(file)).rejects.toThrow();
  });
  it("revalidates redirect destinations and destroys redirect bodies", async () => {
    const redirect = response(302, {
      location: "http://169.254.169.254/latest",
    });
    const request = vi.fn(async () => redirect);
    await expect(
      downloadPublicMediaToFile("https://example.com/image", file, {
        resolveHost: publicDns,
        request,
      }),
    ).rejects.toThrow(/private/i);
    expect(request).toHaveBeenCalledOnce();
    expect(redirect.destroyed).toBe(true);
  });
  it("writes allowed media completely and bounds redirects", async () => {
    const request = vi
      .fn()
      .mockResolvedValueOnce(response(302, { location: "/next" }))
      .mockResolvedValueOnce(response());
    expect(
      await downloadPublicMediaToFile("https://example.com/image", file, {
        resolveHost: publicDns,
        request,
      }),
    ).toMatchObject({
      bytes: png.length,
      extension: "png",
      finalUrl: "https://example.com/next",
    });
    expect(await readFile(file)).toEqual(png);
    await rm(file);
    await expect(
      downloadPublicMediaToFile("https://example.com/image", file, {
        resolveHost: publicDns,
        request: async () => response(302, { location: "/loop" }),
      }),
    ).rejects.toThrow(/redirect limit/i);
  });
  it.each(["text/html", "image/svg+xml"])(
    "rejects executable/unsupported content: %s",
    async (mime) => {
      await expect(
        downloadPublicMediaToFile("https://example.com/image", file, {
          resolveHost: publicDns,
          request: async () => response(200, { "content-type": mime }),
        }),
      ).rejects.toThrow(/supported/i);
      await expect(access(file)).rejects.toThrow();
    },
  );
  it("limits actual body bytes and removes partial output", async () => {
    const body = response();
    await expect(
      downloadPublicMediaToFile("https://example.com/image", file, {
        maxBytes: 6,
        resolveHost: publicDns,
        request: async () => body,
      }),
    ).rejects.toThrow(/byte limit/i);
    expect(body.destroyed).toBe(true);
    await expect(access(file)).rejects.toThrow();
  });
  it("bounds stalled bodies and honors cancellation", async () => {
    const stalled = response(200, { "content-type": "image/png" }, null);
    await expect(
      downloadPublicMediaToFile("https://example.com/image", file, {
        timeoutMs: 20,
        resolveHost: publicDns,
        request: async () => stalled,
      }),
    ).rejects.toMatchObject({ name: "TimeoutError" });
    expect(stalled.destroyed).toBe(true);
    await expect(access(file)).rejects.toThrow();
    const caller = new AbortController();
    caller.abort();
    const request = vi.fn();
    await expect(
      downloadPublicMediaToFile("https://example.com/image", file, {
        signal: caller.signal,
        resolveHost: publicDns,
        request,
      }),
    ).rejects.toMatchObject({ name: "AbortError" });
    expect(request).not.toHaveBeenCalled();
  });
});

it("rejects a network playlist disguised as video before native probing", async () => {
  await expect(
    downloadPublicMediaToFile("https://example.com/image", file, {
      resolveHost: publicDns,
      request: async () =>
        response(
          200,
          { "content-type": "video/mp4" },
          "#EXTM3U\nhttp://169.254.169.254/secret",
        ),
    }),
  ).rejects.toThrow(/signature/i);
  await expect(access(file)).rejects.toThrow();
});

it("preserves the hotlink license gate, including redirects", async () => {
  const request = vi.fn();
  await expect(
    downloadPublicMediaToFile("https://images.unsplash.com/photo", file, {
      resolveHost: publicDns,
      request,
    }),
  ).rejects.toThrow(/hotlink policy/i);
  expect(request).not.toHaveBeenCalled();
  await expect(
    downloadPublicMediaToFile("https://example.com/image", file, {
      resolveHost: publicDns,
      request: async () =>
        response(302, { location: "https://images.unsplash.com/photo" }),
    }),
  ).rejects.toThrow(/hotlink policy/i);
  await expect(access(file)).rejects.toThrow();
});
