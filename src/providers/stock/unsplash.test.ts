import { afterEach, describe, expect, it, vi } from "vitest";

import { materializeStockMedia } from "@/library/stock-media-materialization";
import { reportStockMediaSelectionUsage } from "@/library/stock-media-usage";
import type { StockMediaSelectionDTO } from "./schemas";
import {
  StockMediaProviderRegistry,
  createStockMediaProviderRegistry,
} from "./registry";
import {
  UNSPLASH_API_GUIDELINES_URL,
  createUnsplashMediaProvider,
  createUnsplashProvider,
} from "./unsplash";
import { StockError } from "./types";

const OBSERVED_AT = new Date("2026-09-15T02:00:00.000+05:30");
const IXID = "M3wxMjA3fDB8MHxzZWFyY2h8MXx8b2NlYW58ZW58MHx8fHwx";

function photo() {
  return {
    id: "photo-1",
    width: 4000,
    height: 3000,
    urls: {
      full: `https://images.unsplash.com/photo-1?ixid=${IXID}&q=80`,
      regular: `https://images.unsplash.com/photo-1?ixid=${IXID}&w=1080`,
      small: `https://images.unsplash.com/photo-1?ixid=${IXID}&w=400`,
    },
    links: {
      html: "https://unsplash.com/photos/photo-1",
      download_location: "https://api.unsplash.com/photos/photo-1/download",
    },
    user: {
      name: "Jane Doe",
      username: "jane",
      links: { html: "https://unsplash.com/@jane" },
    },
    description: "Additional documented fields remain compatible",
  };
}

function response(
  body: unknown,
  options: { status?: number; headers?: HeadersInit } = {},
): Response {
  return new Response(JSON.stringify(body), {
    status: options.status ?? 200,
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
  });
}

function provider(fetchImpl: typeof fetch) {
  return createUnsplashMediaProvider({
    apiKey: () => "unsplash_test_key",
    fetchImpl,
    now: () => OBSERVED_AT,
  });
}

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  delete process.env.UNSPLASH_ACCESS_KEY;
});

describe("provider-neutral Unsplash adapter", () => {
  it("exposes image-only hotlink and usage-reporting capabilities without probing", async () => {
    const fetchImpl = vi.fn<typeof fetch>();
    const configured = provider(fetchImpl);
    expect(configured.capabilities).toEqual({
      kinds: ["image"],
      acquisitionPolicies: ["hotlink"],
      maxPageSize: 30,
      supportsPagination: true,
      requiresApiKey: true,
      usageReporting: true,
      defaultCacheTtlSec: 3600,
    });
    await expect(configured.health()).resolves.toMatchObject({
      status: "ready",
    });
    await expect(
      createUnsplashMediaProvider({
        apiKey: () => "",
        now: () => OBSERVED_AT,
      }).health(),
    ).resolves.toMatchObject({ status: "unconfigured" });
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(createStockMediaProviderRegistry().listCapabilities()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "unsplash",
          capabilities: expect.objectContaining({
            acquisitionPolicies: ["hotlink"],
            usageReporting: true,
          }),
        }),
      ]),
    );
  });

  it("maps auth, orientation, pagination, quota, attribution, ixid, and download state", async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(
      response(
        { total: 31, total_pages: 2, results: [photo()] },
        {
          headers: {
            "X-Ratelimit-Limit": "50",
            "X-Ratelimit-Remaining": "49",
          },
        },
      ),
    );
    const result = await provider(fetchImpl).search({
      query: "calm ocean",
      kind: "image",
      orientation: "square",
      pageToken: "1",
      perPage: 30,
    });

    const [requestUrl, init] = fetchImpl.mock.calls[0]!;
    const url = new URL(String(requestUrl));
    expect(url.pathname).toBe("/search/photos");
    expect(url.searchParams.get("query")).toBe("calm ocean");
    expect(url.searchParams.get("orientation")).toBe("squarish");
    expect(url.searchParams.get("page")).toBe("1");
    expect(url.searchParams.get("per_page")).toBe("30");
    expect(url.searchParams.get("client_id")).toBeNull();
    expect((init?.headers as Record<string, string>).Authorization).toBe(
      "Client-ID unsplash_test_key",
    );
    expect(result).toMatchObject({
      nextPageToken: "2",
      total: 31,
      quota: { limit: 50, remaining: 49 },
    });
    expect(result.items[0]).toMatchObject({
      providerId: "unsplash",
      providerAssetId: "photo-1",
      acquisitionPolicy: "hotlink",
      creator: "Jane Doe",
      usageReportUrl: "https://api.unsplash.com/photos/photo-1/download",
      attribution: {
        text: "Photo by Jane Doe on Unsplash",
        required: true,
      },
    });
    expect(result.items[0]!.renderRenditions[0]!.url).toContain(`ixid=${IXID}`);
    expect(result.items[0]!.previewUrl).toContain(`ixid=${IXID}`);
    expect(result.items[0]!.creatorUrl).toContain("utm_source=reel_studio");
    expect(result.items[0]!.sourcePageUrl).toContain("utm_medium=referral");
  });

  it("materializes a selection as the exact remote hotlink without downloading", async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValue(
        response({ total: 1, total_pages: 1, results: [photo()] }),
      );
    const candidate = (
      await provider(fetchImpl).search({
        query: "ocean",
        kind: "image",
        perPage: 1,
      })
    ).items[0]!;
    const download = vi.fn();
    const resolved = await materializeStockMedia(
      {
        candidate,
        rendition: candidate.renderRenditions[0]!,
        termsUrl: UNSPLASH_API_GUIDELINES_URL,
        usageRequired: true,
      },
      { download: download as never, now: () => OBSERVED_AT },
    );

    expect(download).not.toHaveBeenCalled();
    expect(resolved.localAssetId).toBeUndefined();
    expect(resolved.compliantRemoteUrl).toBe(
      candidate.renderRenditions[0]!.url,
    );
    expect(resolved.compliantRemoteUrl).toContain(`ixid=${IXID}`);
    expect(resolved.providerSnapshot.usageReportUrl).toBe(
      "https://api.unsplash.com/photos/photo-1/download",
    );
    expect(resolved.usageEvent).toEqual({ state: "pending" });
  });

  it("reports the persisted download location once and persists success", async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        response({ total: 1, total_pages: 1, results: [photo()] }),
      )
      .mockResolvedValueOnce(
        response({ url: "https://images.unsplash.com/photo-1" }),
      );
    const adapter = provider(fetchImpl);
    const candidate = (
      await adapter.search({ query: "ocean", kind: "image", perPage: 1 })
    ).items[0]!;
    const snapshot = await materializeStockMedia(
      {
        candidate,
        rendition: candidate.renderRenditions[0]!,
        termsUrl: UNSPLASH_API_GUIDELINES_URL,
        usageRequired: true,
      },
      { now: () => OBSERVED_AT },
    );
    let selection: StockMediaSelectionDTO | null = {
      id: "selection-1",
      sceneId: "scene-1",
      snapshot,
      createdAt: OBSERVED_AT.toISOString(),
      updatedAt: OBSERVED_AT.toISOString(),
    };
    const persistence = {
      get: vi.fn(async () => selection),
      save: vi.fn(async (sceneId: string, next: typeof snapshot) => {
        selection = { ...selection!, sceneId, snapshot: next };
        return selection;
      }),
    };
    const registry = new StockMediaProviderRegistry([adapter], {
      getCache: async () => null,
      putCache: async () => undefined,
      deleteCache: async () => undefined,
      getQuota: async () => null,
      putQuota: async () => undefined,
    });

    const reported = await reportStockMediaSelectionUsage("scene-1", {
      registry,
      persistence,
    });
    await reportStockMediaSelectionUsage("scene-1", {
      registry,
      persistence,
    });

    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(String(fetchImpl.mock.calls[1]![0])).toBe(
      "https://api.unsplash.com/photos/photo-1/download",
    );
    expect(reported?.snapshot.usageEvent).toEqual({
      state: "reported",
      reportedAt: OBSERVED_AT.toISOString(),
    });
    expect(persistence.save).toHaveBeenCalledOnce();
  });

  it("persists a failed usage attempt and does not retry it automatically", async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        response({ total: 1, total_pages: 1, results: [photo()] }),
      )
      .mockResolvedValueOnce(
        response({ errors: ["unavailable"] }, { status: 503 }),
      );
    const adapter = provider(fetchImpl);
    const candidate = (
      await adapter.search({ query: "ocean", kind: "image", perPage: 1 })
    ).items[0]!;
    const snapshot = await materializeStockMedia(
      {
        candidate,
        rendition: candidate.renderRenditions[0]!,
        termsUrl: UNSPLASH_API_GUIDELINES_URL,
        usageRequired: true,
      },
      { now: () => OBSERVED_AT },
    );
    let selection: StockMediaSelectionDTO | null = {
      id: "selection-2",
      sceneId: "scene-2",
      snapshot,
      createdAt: OBSERVED_AT.toISOString(),
      updatedAt: OBSERVED_AT.toISOString(),
    };
    const persistence = {
      get: vi.fn(async () => selection),
      save: vi.fn(async (sceneId: string, next: typeof snapshot) => {
        selection = { ...selection!, sceneId, snapshot: next };
        return selection;
      }),
    };
    const registry = new StockMediaProviderRegistry([adapter], {
      getCache: async () => null,
      putCache: async () => undefined,
      deleteCache: async () => undefined,
      getQuota: async () => null,
      putQuota: async () => undefined,
    });

    await expect(
      reportStockMediaSelectionUsage("scene-2", { registry, persistence }),
    ).rejects.toBeInstanceOf(StockError);
    await reportStockMediaSelectionUsage("scene-2", { registry, persistence });

    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(selection?.snapshot.usageEvent).toMatchObject({
      state: "failed",
      error: "Unsplash request failed (HTTP 503).",
    });
  });

  it.each([400, 401, 403, 429, 503])(
    "maps HTTP %s and sends no automatic retry",
    async (status) => {
      const fetchImpl = vi
        .fn<typeof fetch>()
        .mockResolvedValue(response({ errors: ["failed"] }, { status }));
      await expect(
        provider(fetchImpl).search({ query: "x", kind: "image", perPage: 1 }),
      ).rejects.toBeInstanceOf(StockError);
      expect(fetchImpl).toHaveBeenCalledOnce();
    },
  );

  it("rejects missing auth, video, bad page tokens, excessive pages, malformed data, and foreign URLs", async () => {
    await expect(
      createUnsplashMediaProvider({ apiKey: () => "" }).search({
        query: "x",
        kind: "image",
        perPage: 1,
      }),
    ).rejects.toThrow("no API key");
    const configured = provider(
      vi
        .fn<typeof fetch>()
        .mockResolvedValue(
          response({ total: 1, total_pages: 1, results: [photo()] }),
        ),
    );
    await expect(
      configured.search({ query: "x", kind: "video", perPage: 1 }),
    ).rejects.toThrow("does not support video");
    await expect(
      configured.search({
        query: "x",
        kind: "image",
        pageToken: "1.5",
        perPage: 1,
      }),
    ).rejects.toThrow("Invalid Unsplash page token");
    await expect(
      configured.search({ query: "x", kind: "image", perPage: 31 }),
    ).rejects.toThrow("at most 30");
    await expect(
      provider(
        vi.fn<typeof fetch>().mockResolvedValue(response({ results: [] })),
      ).search({ query: "x", kind: "image", perPage: 1 }),
    ).rejects.toThrow("invalid search response");
    await expect(
      provider(
        vi.fn<typeof fetch>().mockResolvedValue(
          response({
            total: 1,
            total_pages: 1,
            results: [
              {
                ...photo(),
                urls: {
                  ...photo().urls,
                  regular: `https://example.com/photo-1?ixid=${IXID}`,
                },
              },
            ],
          }),
        ),
      ).search({ query: "x", kind: "image", perPage: 1 }),
    ).rejects.toThrow("non-Unsplash image hotlink");
  });

  it("propagates caller cancellation and converts timeouts without retry", async () => {
    const caller = new AbortController();
    caller.abort(new Error("cancelled"));
    const fetchImpl = vi.fn<typeof fetch>(async (_url, init) => {
      throw init?.signal?.reason;
    });
    await expect(
      provider(fetchImpl).search(
        { query: "x", kind: "image", perPage: 1 },
        caller.signal,
      ),
    ).rejects.toThrow("cancelled");
    expect(fetchImpl).toHaveBeenCalledOnce();

    vi.useFakeTimers();
    const stalled = vi.fn<typeof fetch>(
      (_url, init) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () =>
            reject(new Error("abort")),
          );
        }),
    );
    const pending = createUnsplashMediaProvider({
      apiKey: () => "key",
      fetchImpl: stalled,
      timeoutMs: 10,
    }).search({ query: "x", kind: "image", perPage: 1 });
    await vi.advanceTimersByTimeAsync(11);
    await expect(pending).rejects.toThrow("timed out without retrying");
    expect(stalled).toHaveBeenCalledOnce();
  });
});

describe("legacy Unsplash wrapper", () => {
  it("preserves image search behavior and delegates usage reporting", async () => {
    process.env.UNSPLASH_ACCESS_KEY = "legacy_key";
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        response({ total: 1, total_pages: 1, results: [photo()] }),
      )
      .mockResolvedValueOnce(
        response({ url: "https://images.unsplash.com/photo-1" }),
      );
    const legacy = createUnsplashProvider({
      fetchImpl,
      now: () => OBSERVED_AT,
    });
    expect(legacy.isConfigured()).toBe(true);
    const images = await legacy.search("calm ocean", "landscape", 3);
    expect(images[0]).toMatchObject({
      credit: "Jane Doe",
      downloadLocation: "https://api.unsplash.com/photos/photo-1/download",
    });
    legacy.trackUsage?.(images[0]!);
    await vi.waitFor(() => expect(fetchImpl).toHaveBeenCalledTimes(2));
    expect(images[0]!.url).toContain(`ixid=${IXID}`);
  });
});
