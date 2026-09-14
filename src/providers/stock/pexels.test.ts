// @vitest-environment node
import { describe, expect, it, vi } from "vitest";

import type {
  SaveStockMediaMaterializationInput,
  StockMediaCacheRecord,
  StockMediaMaterializationRecord,
} from "@/library/repositories/stock-media-services";
import { materializeStockMedia } from "@/library/stock-media-materialization";
import { downloadStockMedia } from "@/library/stock-media-download";
import type { AssetStore } from "@/library/storage";
import {
  createPexelsProvider,
  PEXELS_API_DOCUMENTATION_URL,
  selectPexelsRendition,
} from "./pexels";
import { createStockMediaProviderRegistry } from "./registry";
import type { StockMediaQuotaState } from "./schemas";
import { StockError } from "./types";

const OBSERVED_AT = new Date("2026-09-15T00:00:00.000Z");
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

function quotaHeaders(): Record<string, string> {
  return {
    "X-Ratelimit-Limit": "20000",
    "X-Ratelimit-Remaining": "19684",
    "X-Ratelimit-Reset": "1798761600",
  };
}

function photo(overrides: Record<string, unknown> = {}) {
  return {
    id: 2014422,
    width: 3024,
    height: 4032,
    url: "https://www.pexels.com/photo/golden-hour-2014422/",
    photographer: "Joey Farina",
    photographer_url: "https://www.pexels.com/@joey",
    photographer_id: 680589,
    avg_color: "#978E82",
    src: {
      original:
        "https://images.pexels.com/photos/2014422/pexels-photo-2014422.jpeg",
      medium:
        "https://images.pexels.com/photos/2014422/pexels-photo-2014422.jpeg?auto=compress&h=350",
    },
    ...overrides,
  };
}

function video(overrides: Record<string, unknown> = {}) {
  return {
    id: 2499611,
    width: 1080,
    height: 1920,
    duration: 22,
    url: "https://www.pexels.com/video/2499611/",
    image: "https://images.pexels.com/videos/2499611/free-video-2499611.jpg",
    user: {
      id: 680589,
      name: "Joey Farina",
      url: "https://www.pexels.com/@joey",
    },
    video_files: [
      {
        id: 125006,
        quality: "sd",
        file_type: "video/mp4",
        width: 540,
        height: 960,
        link: "https://videos.pexels.com/video-files/2499611/540x960.mp4",
      },
      {
        id: 125004,
        quality: "hd",
        file_type: "video/mp4",
        width: 1080,
        height: 1920,
        link: "https://videos.pexels.com/video-files/2499611/1080x1920.mp4",
      },
      {
        id: 125010,
        quality: "hd",
        file_type: "video/mp4",
        width: 2160,
        height: 3840,
        link: "https://videos.pexels.com/video-files/2499611/2160x3840.mp4",
      },
      {
        id: 125009,
        quality: "hls",
        file_type: "video/mp4",
        width: null,
        height: null,
        link: "https://player.vimeo.com/external/2499611.m3u8",
      },
    ],
    ...overrides,
  };
}

function provider(fetchImpl: typeof fetch, timeoutMs = 1_000) {
  return createPexelsProvider({
    apiKey: () => "pexels_test_key",
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

describe("Pexels stock-media provider", () => {
  it("discovers photo/video capabilities and reports key health locally", async () => {
    const configured = provider(vi.fn<typeof fetch>());
    expect(
      createStockMediaProviderRegistry([configured]).listCapabilities(),
    ).toEqual([
      expect.objectContaining({
        id: "pexels",
        capabilities: expect.objectContaining({
          kinds: ["image", "video"],
          maxPageSize: 80,
          requiresApiKey: true,
        }),
      }),
    ]);
    await expect(configured.health()).resolves.toMatchObject({
      status: "ready",
      checkedAt: OBSERVED_AT.toISOString(),
    });
    await expect(
      createPexelsProvider({
        apiKey: () => "",
        now: () => OBSERVED_AT,
      }).health(),
    ).resolves.toMatchObject({ status: "unconfigured" });
    expect(createStockMediaProviderRegistry().listCapabilities()).toEqual([
      expect.objectContaining({ id: "pexels", label: "Pexels" }),
    ]);
  });

  it("authenticates and maps photo search, orientation, pagination, quota, and attribution", async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(
      response(
        {
          page: 2,
          per_page: 12,
          total_results: 81,
          next_page:
            "https://api.pexels.com/v1/search?query=golden+hour&page=3&per_page=12",
          photos: [photo()],
        },
        { headers: quotaHeaders() },
      ),
    );
    const result = await provider(fetchImpl).search({
      query: "golden hour",
      kind: "image",
      orientation: "portrait",
      pageToken: "2",
      perPage: 12,
    });

    expect(result).toMatchObject({
      nextPageToken: "3",
      total: 81,
      quota: {
        limit: 20000,
        remaining: 19684,
        resetAt: "2027-01-01T00:00:00.000Z",
        observedAt: OBSERVED_AT.toISOString(),
      },
    });
    expect(result.items[0]).toMatchObject({
      providerId: "pexels",
      providerAssetId: "2014422",
      kind: "image",
      creator: "Joey Farina",
      creatorUrl: "https://www.pexels.com/@joey",
      sourcePageUrl: "https://www.pexels.com/photo/golden-hour-2014422/",
      acquisitionPolicy: "download",
      attribution: {
        text: "Photo by Joey Farina on Pexels",
        required: true,
        licenseName: "Pexels License",
      },
      renderRenditions: [expect.objectContaining({ id: "original" })],
    });
    const [url, init] = fetchImpl.mock.calls[0]!;
    expect(String(url)).toBe(
      "https://api.pexels.com/v1/search?query=golden+hour&page=2&per_page=12&orientation=portrait",
    );
    expect(init?.headers).toEqual({
      Accept: "application/json",
      Authorization: "pexels_test_key",
    });
    expect(init?.redirect).toBe("error");
  });

  it("uses the shared response cache and persists returned Pexels quota", async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(
      response(
        {
          page: 1,
          per_page: 1,
          total_results: 1,
          photos: [photo()],
        },
        { headers: quotaHeaders() },
      ),
    );
    const persistence = memoryRegistryPersistence();
    const registry = createStockMediaProviderRegistry(
      [provider(fetchImpl)],
      persistence,
    );
    const request = {
      query: "golden hour",
      kind: "image" as const,
      perPage: 1,
    };
    await registry.search("pexels", request);
    await registry.search("pexels", request);

    expect(fetchImpl).toHaveBeenCalledOnce();
    await expect(registry.quota("pexels")).resolves.toMatchObject({
      limit: 20000,
      remaining: 19684,
    });
  });

  it("uses the current video route and selects the smallest target-fitting rendition", async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(
      response({
        page: 1,
        per_page: 5,
        total_results: 1,
        videos: [video()],
      }),
    );
    const result = await provider(fetchImpl).search({
      query: "city walk",
      kind: "video",
      orientation: "portrait",
      perPage: 5,
    });

    expect(String(fetchImpl.mock.calls[0]![0])).toContain("/v1/videos/search?");
    expect(String(fetchImpl.mock.calls[0]![0])).not.toContain(
      "api.pexels.com/videos/",
    );
    expect(result.items).toHaveLength(1);
    expect(result.items[0]).toMatchObject({
      kind: "video",
      durationSec: 22,
      orientation: "portrait",
      creator: "Joey Farina",
      acquisitionPolicy: "download",
      attribution: {
        text: "Video by Joey Farina on Pexels",
        required: true,
      },
    });
    expect(result.items[0]!.renderRenditions).toHaveLength(3);
    expect(selectPexelsRendition(result.items[0]!)).toMatchObject({
      id: "file-125004",
      width: 1080,
      height: 1920,
      mimeType: "video/mp4",
    });
  });

  it("materializes a selected Pexels rendition through the shared local store", async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(
      response({
        page: 1,
        per_page: 1,
        total_results: 1,
        photos: [photo({ width: 1, height: 1 })],
      }),
    );
    const result = await provider(fetchImpl).search({
      query: "pixel",
      kind: "image",
      perPage: 1,
    });
    const candidate = result.items[0]!;
    const store = new MemoryStore();
    const persistence = memoryMaterializations();
    const mediaFetch = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(PNG_1X1, {
        status: 200,
        headers: {
          "content-type": "image/png",
          "content-length": String(PNG_1X1.length),
        },
      }),
    );

    const materialized = await materializeStockMedia(
      {
        candidate,
        rendition: selectPexelsRendition(candidate),
        termsUrl: PEXELS_API_DOCUMENTATION_URL,
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
    expect(materialized).toMatchObject({
      localAssetId: expect.stringMatching(/^stock-[a-f0-9]{64}$/),
      contentHash: expect.stringMatching(/^[a-f0-9]{64}$/),
      providerSnapshot: { providerId: "pexels" },
    });
    expect(materialized.compliantRemoteUrl).toBeUndefined();
    expect(mediaFetch).toHaveBeenCalledOnce();
    expect(store.files.size).toBe(1);
    expect(persistence.records.size).toBe(1);
  });

  it.each([
    [401, "rejected the API key"],
    [403, "denied access"],
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
        perPage: 1,
      }),
    ).rejects.toMatchObject({
      message: expect.stringContaining(message),
      status,
      providerId: "pexels",
    });
    expect(fetchImpl).toHaveBeenCalledOnce();
  });

  it("rejects missing auth and malformed page tokens before making a request", async () => {
    const fetchImpl = vi.fn<typeof fetch>();
    await expect(
      createPexelsProvider({ apiKey: () => "", fetchImpl }).search({
        query: "nature",
        kind: "image",
        perPage: 1,
      }),
    ).rejects.toBeInstanceOf(StockError);
    await expect(
      provider(fetchImpl).search({
        query: "nature",
        kind: "image",
        pageToken: "2.5",
        perPage: 1,
      }),
    ).rejects.toThrow("Invalid Pexels page token");
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("rejects malformed JSON, response fields, pagination, and quota headers", async () => {
    await expect(
      provider(
        vi.fn<typeof fetch>().mockResolvedValue(
          new Response("not json", {
            status: 200,
            headers: { "content-type": "application/json" },
          }),
        ),
      ).search({ query: "nature", kind: "image", perPage: 1 }),
    ).rejects.toThrow("malformed JSON");

    await expect(
      provider(
        vi
          .fn<typeof fetch>()
          .mockResolvedValue(
            response({ page: 1, per_page: 1, total_results: 1, photos: [{}] }),
          ),
      ).search({ query: "nature", kind: "image", perPage: 1 }),
    ).rejects.toThrow("failed validation");

    await expect(
      provider(
        vi
          .fn<typeof fetch>()
          .mockResolvedValue(
            response({ page: 2, per_page: 1, total_results: 0, photos: [] }),
          ),
      ).search({ query: "nature", kind: "image", perPage: 1 }),
    ).rejects.toThrow("inconsistent pagination");

    await expect(
      provider(
        vi
          .fn<typeof fetch>()
          .mockResolvedValue(
            response(
              { page: 1, per_page: 1, total_results: 0, photos: [] },
              { headers: { "X-Ratelimit-Limit": "20000" } },
            ),
          ),
      ).search({ query: "nature", kind: "image", perPage: 1 }),
    ).rejects.toThrow("incomplete rate-limit headers");

    await expect(
      provider(
        vi.fn<typeof fetch>().mockResolvedValue(
          response({
            page: 1,
            per_page: 1,
            total_results: 0,
            next_page:
              "https://api.pexels.com/v1/search?query=nature&page=9&per_page=1",
            photos: [],
          }),
        ),
      ).search({ query: "nature", kind: "image", perPage: 1 }),
    ).rejects.toThrow("invalid next-page URL");
  });

  it("drops unmaterializable HLS video results and preserves an empty result", async () => {
    const hlsOnly = video({
      video_files: [
        {
          id: 1,
          quality: "hls",
          file_type: "video/mp4",
          width: null,
          height: null,
          link: "https://player.vimeo.com/external/video.m3u8",
        },
      ],
    });
    const result = await provider(
      vi.fn<typeof fetch>().mockResolvedValue(
        response({
          page: 1,
          per_page: 2,
          total_results: 1,
          videos: [hlsOnly],
        }),
      ),
    ).search({ query: "nature", kind: "video", perPage: 2 });
    expect(result.items).toEqual([]);
    expect(result.total).toBe(1);
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
        perPage: 1,
      }),
    ).rejects.toMatchObject({ status: 504, providerId: "pexels" });
    expect(hangingFetch).toHaveBeenCalledOnce();

    const controller = new AbortController();
    const cancelledFetch = vi.fn<typeof fetch>(async (_input, init) => {
      controller.abort(new Error("cancelled by caller"));
      throw init?.signal?.reason;
    });
    await expect(
      provider(cancelledFetch).search(
        { query: "cancel", kind: "image", perPage: 1 },
        controller.signal,
      ),
    ).rejects.toThrow("cancelled by caller");
    expect(cancelledFetch).toHaveBeenCalledOnce();
  });
});
