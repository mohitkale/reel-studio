// @vitest-environment node
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { tmpdir } from "node:os";
import { NextRequest } from "next/server";
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { LocalDiskStore } from "@/library/storage/local-disk";
import { GET, HEAD } from "./route";

const mocked = vi.hoisted(() => ({ store: vi.fn() }));
vi.mock("@/library/storage", () => ({ getAssetStore: mocked.store }));
let directory: string;
let store: LocalDiskStore;
beforeEach(async () => {
  vi.stubEnv("REEL_STRICT_AUTH", "");
  directory = await mkdtemp(path.join(tmpdir(), "reel-media-"));
  store = new LocalDiskStore(directory);
  mocked.store.mockReturnValue(store);
  await writeFile(path.join(directory, "clip.mp4"), "0123456789");
  await writeFile(path.join(directory, "empty.mp4"), "");
});
afterEach(async () => {
  vi.unstubAllEnvs();
  await rm(directory, { recursive: true, force: true });
});
const request = (range?: string, signal?: AbortSignal) => new NextRequest("http://localhost:3000/media/clip.mp4", {
  headers: { host: "localhost:3000", ...(range ? { range } : {}) }, signal,
});
const context = (key = "clip.mp4") => ({ params: Promise.resolve({ path: [key] }) });

describe("media HTTP reads", () => {
  it.each([
    [undefined, 200, "0123456789", null],
    ["bytes=2-4", 206, "234", "bytes 2-4/10"],
    ["bytes=7-", 206, "789", "bytes 7-9/10"],
    ["bytes=-3", 206, "789", "bytes 7-9/10"],
    ["bytes=-99", 206, "0123456789", "bytes 0-9/10"],
    ["bytes=8-99", 206, "89", "bytes 8-9/10"],
  ] as const)("%s returns %s with exact length", async (range, status, body, contentRange) => {
    const get = vi.spyOn(store, "get");
    const response = await GET(request(range), context());
    expect(response.status).toBe(status);
    expect(response.headers.get("content-length")).toBe(String(body.length));
    expect(response.headers.get("content-range")).toBe(contentRange);
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
    expect(await response.text()).toBe(body);
    expect(get).not.toHaveBeenCalled();
  });
  it.each(["bytes=10-", "bytes=8-2", "bytes=-0", "bytes=-", "bytes=0-1,3-4", "bytes=9007199254740992-", "junk bytes=0-1", "items=0-1"])("rejects %s without sending a body", async (range) => {
    const response = await GET(request(range), context());
    expect(response.status).toBe(416);
    expect(response.headers.get("content-range")).toBe("bytes */10");
    expect(await response.text()).toBe("");
  });
  it("handles HEAD, missing/empty assets and scriptable SVG safely", async () => {
    const head = await HEAD(request("bytes=2-4"), context());
    expect(head.status).toBe(200);
    expect(head.headers.get("content-length")).toBe("10");
    expect(await head.text()).toBe("");
    expect((await GET(request(), context("missing"))).status).toBe(404);
    expect(await (await GET(request(), context("empty.mp4"))).text()).toBe("");
    expect((await GET(request("bytes=0-"), context("empty.mp4"))).status).toBe(416);
    await writeFile(path.join(directory, "image.svg"), "<svg/>");
    const svg = await GET(request(), context("image.svg"));
    expect(svg.headers.get("content-type")).toBe("application/octet-stream");
    await svg.text();
  });
  it("closes when a client disconnects after response creation", async () => {
    const controller = new AbortController();
    const response = await GET(request(undefined, controller.signal), context());
    controller.abort();
    await expect(response.text()).rejects.toThrow();
    await rm(path.join(directory, "clip.mp4"));
  });
});
