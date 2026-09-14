// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";

import { downloadStockMedia } from "@/library/stock-media-download";
import { materializeStockMedia } from "@/library/stock-media-materialization";
import type {
  SaveStockMediaMaterializationInput,
  StockMediaCacheRecord,
  StockMediaMaterializationRecord,
} from "@/library/repositories/stock-media-services";
import type { AssetStore } from "@/library/storage";
import {
  createPixabayProvider,
  PIXABAY_API_DOCUMENTATION_URL,
  selectPixabayRendition,
} from "./pixabay";
import { createStockMediaProviderRegistry } from "./registry";
import type { StockMediaCandidate, StockMediaQuotaState } from "./schemas";
import { StockError } from "./types";

const OBSERVED_AT = new Date("2026-09-15T02:00:00.000Z");
const PNG_1X1 = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
  "base64",
);

function response(
  body: unknown,
  options: { status?: number; headers?: Record<string, string> } = {},
): Response {
  return new Response(JSON.stringify(body), {
    status: options.status ?? 200,
    headers: {
      "content-type": "application/json",
      ...options.headers,
    },
  });
}

function rateHeaders(): Record<string, string> {
  return {
    "X-RateLimit-Limit": "100",
    "X-RateLimit-Remaining": "99",
    "X-RateLimit-Reset": "60",
  };
}

function imageHit(overrides: Record<string, unknown> = {}) {
  return {
    id: 195893,
    pageURL: "https://pixabay.com/photos/blossom-flower-195893/",
    type: "photo",
    tags: "blossom, flower",
    previewURL:
      "https://cdn.pixabay.com/photo/2013/10/15/flower-195893_150.jpg",
    previewWidth: 150,
    previewHeight: 100,
    webformatURL:
      "https://pixabay.com/get/flower-195893_640.jpg?token=temporary",
    webformatWidth: 640,
    webformatHeight: 427,
    imageWidth: 4000,
    imageHeight: 2667,
    imageSize: 4_731_420,
    user_id: 48777,
    user: "Josch13",
    ...overrides,
  };
}

function videoFile(name: string, width: number, height: number, size: number) {
  return {
    url: `https://cdn.pixabay.com/video/125_${name}.mp4?token=temporary`,
    width,
    height,
    size,
    thumbnail: `https://cdn.pixabay.com/video/125_${name}.jpg`,
  };
}

function videoHit(overrides: Record<string, unknown> = {}) {
  return {
    id: 125,
    pageURL: "https://pixabay.com/videos/id-125/",
    type: "film",
    tags: "flowers, yellow, blossom",
    duration: 12,
    videos: {
      large: videoFile("large", 3840, 2160, 12_000_000),
      medium: videoFile("medium", 1920, 1080, 6_000_000),
      small: videoFile("small", 1280, 720, 3_000_000),
      tiny: videoFile("tiny", 640, 360, 1_000_000),
    },
    user_id: 1281706,
    user: "Pixabay-Creator",
    ...overrides,
  };
}

function provider(fetchImpl: typeof fetch, timeoutMs = 1_000) {
  return createPixabayProvider({
    apiKey: () => "pixabay_test_key",
    fetchImpl,
    now: () => OBSERVED_AT,
    timeoutMs,
  });
}

class MemoryStore implements AssetStore {
  readonly files = new Map<string, Buffer>();

  async put(key: string, data: Buffer) {
    this.files.set(key, Buffer.from(data));
    return { key };
  }

  async get(key: string) {
    const data = this.files.get(key);
    if (!data) throw new Error("missing");
    return Buffer.from(data);
  }

  url(key: string) {
    return `/media/${key}`;
  }

  async exists(key: string) {
    return this.files.has(key);
  }

  async delete(key: string) {
    this.files.delete(key);
  }
}

function memoryMaterializations() {
  const records = new Map<string, StockMediaMaterializationRecord>();
  return {
    records,
    async getMaterialization(requestHash: string) {
      return records.get(requestHash) ?? null;
    },
    async putMaterialization(input: SaveStockMediaMaterializationInput) {
      const record: StockMediaMaterializationRecord = { ...input };
      records.set(input.requestHash, record);
      return record;
    },
  };
}

function memoryRegistryPersistence() {
  const caches = new Map<string, StockMediaCacheRecord>();
  const quotas = new Map<string, StockMediaQuotaState>();
  return {
    caches,
    async getCache(requestHash: string) {
      return caches.get(requestHash) ?? null;
    },
    async putCache(record: StockMediaCacheRecord) {
      caches.set(record.requestHash, record);
    },
    async deleteCache(requestHash: string) {
      caches.delete(requestHash);
    },
    async getQuota(providerId: string) {
      return quotas.get(providerId) ?? null;
    },
    async putQuota(providerId: string, quota: StockMediaQuotaState) {
      quotas.set(providerId, quota);
    },
  };
}

afterEach(() => vi.useRealTimers());

describe("Pixabay stock-media provider", () => {
  it("registers image/video capabilities and reports key health without a request", async () => {
    const configured = provider(vi.fn<typeof fetch>());
    await expect(configured.health()).resolves.toMatchObject({
      status: "ready",
      checkedAt: OBSERVED_AT.toISOString(),
    });
    await expect(
      createPixabayProvider({
        apiKey: () => "",
        now: () => OBSERVED_AT,
      }).health(),
    ).resolves.toMatchObject({ status: "unconfigured" });
    expect(createStockMediaProviderRegistry().listCapabilities()).toEqual([
      expect.objectContaining({ id: "pexels" }),
      expect.objectContaining({
        id: "pixabay",
        capabilities: expect.objectContaining({
          kinds: ["image", "video"],
          defaultCacheTtlSec: 86_400,
        }),
      }),
    ]);
  });

  it("authenticates image search, maps orientation, and keeps remote URLs as previews", async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValue(
        response(
          { total: 900, totalHits: 500, hits: [imageHit()] },
          { headers: rateHeaders() },
        ),
      );
    const result = await provider(fetchImpl).search({
      query: "yellow flowers",
      kind: "image",
      orientation: "portrait",
      pageToken: "2",
      perPage: 20,
    });

    const url = new URL(String(fetchImpl.mock.calls[0]![0]));
    expect(`${url.origin}${url.pathname}`).toBe("https://pixabay.com/api/");
    expect(Object.fromEntries(url.searchParams)).toMatchObject({
      key: "pixabay_test_key",
      q: "yellow flowers",
      orientation: "vertical",
      image_type: "photo",
      safesearch: "true",
      page: "2",
      per_page: "20",
    });
    expect(fetchImpl.mock.calls[0]![1]?.headers).toEqual({
      Accept: "application/json",
    });
    expect(result).toMatchObject({
      total: 500,
      nextPageToken: "3",
      quota: {
        limit: 100,
        remaining: 99,
        resetAt: "2026-09-15T02:01:00.000Z",
      },
    });
    expect(result.items[0]).toMatchObject({
      providerId: "pixabay",
      providerAssetId: "195893",
      kind: "image",
      previewUrl:
        "https://cdn.pixabay.com/photo/2013/10/15/flower-195893_150.jpg",
      sourcePageUrl: "https://pixabay.com/photos/blossom-flower-195893/",
      creator: "Josch13",
      creatorUrl: "https://pixabay.com/users/Josch13-48777/",
      acquisitionPolicy: "download",
      attribution: {
        text: "Image by Josch13 on Pixabay",
        required: true,
      },
    });
    expect(result.items[0]!.previewUrl).not.toBe(
      result.items[0]!.renderRenditions[0]!.url,
    );
  });

  it("maps video renditions and selects the smallest target-fitting file", async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValue(
        response({ total: 1, totalHits: 1, hits: [videoHit()] }),
      );
    const result = await provider(fetchImpl).search({
      query: "flowers",
      kind: "video",
      orientation: "landscape",
      perPage: 20,
    });

    expect(new URL(String(fetchImpl.mock.calls[0]![0])).pathname).toBe(
      "/api/videos/",
    );
    expect(result.items[0]).toMatchObject({
      providerId: "pixabay",
      kind: "video",
      durationSec: 12,
      orientation: "landscape",
      attribution: {
        text: "Video by Pixabay-Creator on Pixabay",
        required: true,
      },
    });
    expect(selectPixabayRendition(result.items[0]!)).toMatchObject({
      id: "medium",
      width: 1920,
      height: 1080,
      fileSizeBytes: 6_000_000,
      mimeType: "video/mp4",
    });
  });

  it("enforces the required 24-hour response cache and excludes the key from cache data", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(OBSERVED_AT);
    const fetchImpl = vi.fn<typeof fetch>(async () =>
      response(
        { total: 1, totalHits: 1, hits: [imageHit()] },
        { headers: rateHeaders() },
      ),
    );
    const persistence = memoryRegistryPersistence();
    const registry = createStockMediaProviderRegistry(
      [provider(fetchImpl)],
      persistence,
    );
    const request = {
      query: "flower",
      kind: "image" as const,
      perPage: 20,
    };
    await registry.search("pixabay", request);
    vi.setSystemTime(new Date(OBSERVED_AT.getTime() + 86_399_000));
    await registry.search("pixabay", request);
    expect(fetchImpl).toHaveBeenCalledOnce();

    const cached = [...persistence.caches.values()][0]!;
    expect(cached.expiresAt.getTime()).toBe(OBSERVED_AT.getTime() + 86_400_000);
    expect(cached.requestJson).not.toContain("pixabay_test_key");
    await expect(registry.quota("pixabay")).resolves.toMatchObject({
      remaining: 99,
    });

    vi.setSystemTime(new Date(OBSERVED_AT.getTime() + 86_400_001));
    await registry.search("pixabay", request);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it("refreshes an expired provider URL before local materialization", async () => {
    const oldUrl =
      "https://pixabay.com/get/flower-195893_640.jpg?token=expired";
    const freshUrl =
      "https://pixabay.com/get/flower-195893_640.jpg?token=fresh";
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        response({
          total: 1,
          totalHits: 1,
          hits: [imageHit({ webformatURL: oldUrl })],
        }),
      )
      .mockResolvedValueOnce(
        response({
          total: 1,
          totalHits: 1,
          hits: [imageHit({ webformatURL: freshUrl })],
        }),
      );
    const pixabay = provider(fetchImpl);
    const search = await pixabay.search({
      query: "flower",
      kind: "image",
      perPage: 20,
    });
    const stale = search.items[0]!;
    const refreshed = await pixabay.resolve!(
      stale,
      selectPixabayRendition(stale),
    );
    expect(refreshed.rendition.url).toBe(freshUrl);
    const resolveUrl = new URL(String(fetchImpl.mock.calls[1]![0]));
    expect(resolveUrl.searchParams.get("id")).toBe("195893");
    expect(resolveUrl.searchParams.get("q")).toBeNull();

    const store = new MemoryStore();
    const persistence = memoryMaterializations();
    const mediaFetch = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(PNG_1X1, {
        status: 200,
        headers: { "content-type": "image/png" },
      }),
    );
    const materialized = await materializeStockMedia(
      {
        candidate: refreshed.candidate,
        rendition: refreshed.rendition,
        termsUrl: PIXABAY_API_DOCUMENTATION_URL,
      },
      {
        store,
        persistence,
        download: (rendition, kind, options) =>
          downloadStockMedia(rendition, kind, {
            ...options,
            fetchImpl: mediaFetch,
          }),
        now: () => OBSERVED_AT,
      },
    );
    expect(materialized.localAssetId).toMatch(/^stock-[a-f0-9]{64}$/);
    expect(materialized.compliantRemoteUrl).toBeUndefined();
    expect(store.files.size).toBe(1);
  });

  it("does not persist expired or corrupt selected media", async () => {
    const candidate = {
      providerId: "pixabay",
      providerAssetId: "195893",
      kind: "image",
      previewUrl:
        "https://cdn.pixabay.com/photo/2013/10/15/flower-195893_150.jpg",
      sourcePageUrl: "https://pixabay.com/photos/blossom-flower-195893/",
      creator: "Josch13",
      width: 1,
      height: 1,
      orientation: "square",
      renderRenditions: [
        {
          id: "webformat",
          url: "https://pixabay.com/get/expired.jpg",
          width: 1,
          height: 1,
        },
      ],
      attribution: {
        text: "Image by Josch13 on Pixabay",
        required: true,
      },
      acquisitionPolicy: "download",
    } satisfies StockMediaCandidate;

    for (const mediaResponse of [
      new Response("expired", { status: 403 }),
      new Response(Buffer.from("corrupt"), {
        status: 200,
        headers: { "content-type": "image/jpeg" },
      }),
    ]) {
      const store = new MemoryStore();
      const persistence = memoryMaterializations();
      await expect(
        materializeStockMedia(
          {
            candidate,
            rendition: candidate.renderRenditions[0],
            termsUrl: PIXABAY_API_DOCUMENTATION_URL,
          },
          {
            store,
            persistence,
            download: (rendition, kind, options) =>
              downloadStockMedia(rendition, kind, {
                ...options,
                fetchImpl: vi
                  .fn<typeof fetch>()
                  .mockResolvedValue(mediaResponse),
              }),
          },
        ),
      ).rejects.toBeInstanceOf(Error);
      expect(store.files.size).toBe(0);
      expect(persistence.records.size).toBe(0);
    }
  });

  it("materializes selected video metadata through the shared local store", async () => {
    const result = await provider(
      vi
        .fn<typeof fetch>()
        .mockResolvedValue(
          response({ total: 1, totalHits: 1, hits: [videoHit()] }),
        ),
    ).search({ query: "flowers", kind: "video", perPage: 20 });
    const candidate = result.items[0]!;
    const rendition = selectPixabayRendition(candidate);
    const store = new MemoryStore();
    const persistence = memoryMaterializations();
    const bytes = Buffer.from("fixture mp4 bytes");
    const materialized = await materializeStockMedia(
      {
        candidate,
        rendition,
        termsUrl: PIXABAY_API_DOCUMENTATION_URL,
      },
      {
        store,
        persistence,
        download: async () => ({
          data: bytes,
          finalUrl: rendition.url,
          metadata: {
            kind: "video",
            mimeType: "video/mp4",
            extension: "mp4",
            width: rendition.width,
            height: rendition.height,
            durationSec: 12,
            bytes: bytes.length,
          },
        }),
        now: () => OBSERVED_AT,
      },
    );
    expect(materialized.localAssetId).toMatch(/^stock-[a-f0-9]{64}$/);
    expect(store.files.size).toBe(1);
  });

  it.each([
    [400, "rejected the request or API key"],
    [401, "rejected the request or API key"],
    [429, "rate limit exceeded"],
    [503, "HTTP 503"],
  ])("maps HTTP %i without retrying", async (status, message) => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValue(response({ error: "provider failure" }, { status }));
    await expect(
      provider(fetchImpl).search({
        query: "failure",
        kind: "image",
        perPage: 20,
      }),
    ).rejects.toMatchObject({
      message: expect.stringContaining(message),
      status,
      providerId: "pixabay",
    });
    expect(fetchImpl).toHaveBeenCalledOnce();
  });

  it("rejects missing auth, provider-invalid bounds, and malformed responses", async () => {
    const fetchImpl = vi.fn<typeof fetch>();
    await expect(
      createPixabayProvider({ apiKey: () => "", fetchImpl }).search({
        query: "nature",
        kind: "image",
        perPage: 20,
      }),
    ).rejects.toBeInstanceOf(StockError);
    await expect(
      provider(fetchImpl).search({
        query: "nature",
        kind: "image",
        perPage: 2,
      }),
    ).rejects.toThrow("at least 3");
    await expect(
      provider(fetchImpl).search({
        query: "x".repeat(101),
        kind: "image",
        perPage: 20,
      }),
    ).rejects.toThrow("100 characters");
    await expect(
      provider(fetchImpl).search({
        query: "nature",
        kind: "image",
        pageToken: "1.5",
        perPage: 20,
      }),
    ).rejects.toThrow("Invalid Pixabay page token");
    expect(fetchImpl).not.toHaveBeenCalled();

    await expect(
      provider(
        vi.fn<typeof fetch>().mockResolvedValue(
          new Response("not json", {
            status: 200,
            headers: { "content-type": "application/json" },
          }),
        ),
      ).search({ query: "nature", kind: "image", perPage: 20 }),
    ).rejects.toThrow("malformed JSON");
    await expect(
      provider(
        vi
          .fn<typeof fetch>()
          .mockResolvedValue(response({ total: 1, totalHits: 1, hits: [{}] })),
      ).search({ query: "nature", kind: "image", perPage: 20 }),
    ).rejects.toThrow("failed validation");
    await expect(
      provider(
        vi
          .fn<typeof fetch>()
          .mockResolvedValue(
            response(
              { total: 0, totalHits: 0, hits: [] },
              { headers: { "X-RateLimit-Limit": "100" } },
            ),
          ),
      ).search({ query: "nature", kind: "image", perPage: 20 }),
    ).rejects.toThrow("incomplete rate-limit headers");
  });

  it("returns no results without inventing candidates", async () => {
    const result = await provider(
      vi
        .fn<typeof fetch>()
        .mockResolvedValue(response({ total: 0, totalHits: 0, hits: [] })),
    ).search({ query: "no results", kind: "video", perPage: 20 });
    expect(result).toEqual({
      items: [],
      nextPageToken: undefined,
      total: 0,
      quota: undefined,
    });
  });

  it("times out once and forwards caller cancellation", async () => {
    const hangingFetch = vi.fn<typeof fetch>((_input, init) => {
      return new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener(
          "abort",
          () => reject(init.signal?.reason),
          { once: true },
        );
      });
    });
    await expect(
      provider(hangingFetch, 5).search({
        query: "slow",
        kind: "image",
        perPage: 20,
      }),
    ).rejects.toMatchObject({ status: 504, providerId: "pixabay" });
    expect(hangingFetch).toHaveBeenCalledOnce();

    const controller = new AbortController();
    const cancelledFetch = vi.fn<typeof fetch>(async (_input, init) => {
      controller.abort(new Error("cancelled by caller"));
      throw init?.signal?.reason;
    });
    await expect(
      provider(cancelledFetch).search(
        { query: "cancel", kind: "video", perPage: 20 },
        controller.signal,
      ),
    ).rejects.toThrow("cancelled by caller");
    expect(cancelledFetch).toHaveBeenCalledOnce();
  });
});
