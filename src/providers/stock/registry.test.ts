import { describe, expect, it, vi } from "vitest";

import type { StockMediaCacheRecord } from "@/library/repositories/stock-media-services";
import { normalizeStockMediaRequest } from "@/library/stock-media-cache";
import type { StockMediaCandidate, StockMediaQuotaState } from "./schemas";
import { StockMediaProviderRegistry } from "./registry";
import type { StockMediaProvider } from "./types";

function fixtureCandidate(): StockMediaCandidate {
  return {
    providerId: "fixture",
    providerAssetId: "photo-1",
    kind: "image",
    previewUrl: "https://cdn.example.test/preview.jpg",
    sourcePageUrl: "https://example.test/photo-1",
    creator: "Fixture Creator",
    width: 1200,
    height: 1600,
    orientation: "portrait",
    mimeType: "image/jpeg",
    renderRenditions: [
      {
        id: "large",
        url: "https://cdn.example.test/photo-1.jpg",
        width: 1200,
        height: 1600,
        mimeType: "image/jpeg",
      },
    ],
    attribution: { text: "Fixture Creator", required: true },
    acquisitionPolicy: "download",
  };
}

function memoryPersistence() {
  const caches = new Map<string, StockMediaCacheRecord>();
  const quotas = new Map<string, StockMediaQuotaState>();
  return {
    caches,
    quotas,
    async getCache(key: string) {
      return caches.get(key) ?? null;
    },
    async putCache(record: StockMediaCacheRecord) {
      caches.set(record.requestHash, record);
    },
    async deleteCache(key: string) {
      caches.delete(key);
    },
    async getQuota(providerId: string) {
      return quotas.get(providerId) ?? null;
    },
    async putQuota(providerId: string, quota: StockMediaQuotaState) {
      quotas.set(providerId, quota);
    },
  };
}

describe("stock-media provider registry", () => {
  it("discovers capabilities and health", async () => {
    const provider: StockMediaProvider = {
      id: "fixture",
      label: "Fixture",
      capabilities: {
        kinds: ["image"],
        acquisitionPolicies: ["download"],
        maxPageSize: 25,
        supportsPagination: true,
        requiresApiKey: false,
        usageReporting: false,
        defaultCacheTtlSec: 60,
      },
      health: async () => ({
        status: "ready",
        checkedAt: "2026-09-14T14:30:00.000Z",
      }),
      search: async () => ({ items: [] }),
    };
    const registry = new StockMediaProviderRegistry(
      [provider],
      memoryPersistence(),
    );
    expect(registry.listCapabilities()).toEqual([
      expect.objectContaining({
        id: "fixture",
        capabilities: expect.objectContaining({ kinds: ["image"] }),
      }),
    ]);
    await expect(registry.health("fixture")).resolves.toMatchObject({
      status: "ready",
    });
  });

  it("normalizes cache keys, expires responses, and persists live quota", async () => {
    let now = new Date("2026-09-14T14:30:00.000Z");
    const candidate = fixtureCandidate();
    const search = vi.fn(async () => ({
      items: [candidate],
      quota: {
        limit: 100,
        remaining: 99,
        observedAt: now.toISOString(),
      },
    }));
    const provider: StockMediaProvider = {
      id: "fixture",
      label: "Fixture",
      capabilities: {
        kinds: ["image"],
        acquisitionPolicies: ["download"],
        maxPageSize: 25,
        supportsPagination: true,
        requiresApiKey: false,
        usageReporting: false,
        defaultCacheTtlSec: 60,
      },
      health: async () => ({ status: "ready", checkedAt: now.toISOString() }),
      search,
    };
    const persistence = memoryPersistence();
    const registry = new StockMediaProviderRegistry([provider], persistence);
    vi.setSystemTime(now);
    await registry.search("fixture", {
      query: "calm ocean",
      kind: "image",
      perPage: 10,
    });
    await registry.search("fixture", {
      perPage: 10,
      kind: "image",
      query: "calm ocean",
    });
    expect(search).toHaveBeenCalledTimes(1);
    await expect(registry.quota("fixture")).resolves.toMatchObject({
      remaining: 99,
    });

    now = new Date("2026-09-14T14:31:01.000Z");
    vi.setSystemTime(now);
    await registry.search("fixture", {
      query: "calm ocean",
      kind: "image",
      perPage: 10,
    });
    expect(search).toHaveBeenCalledTimes(2);
    vi.useRealTimers();

    expect(normalizeStockMediaRequest({ b: 2, a: { d: 4, c: 3 } })).toBe(
      normalizeStockMediaRequest({ a: { c: 3, d: 4 }, b: 2 }),
    );
  });

  it("bounds searches and validates resolve and usage ownership", async () => {
    const candidate = fixtureCandidate();
    const reportUsage = vi.fn(async () => undefined);
    const provider: StockMediaProvider = {
      id: "fixture",
      label: "Fixture",
      capabilities: {
        kinds: ["image"],
        acquisitionPolicies: ["download"],
        maxPageSize: 5,
        supportsPagination: false,
        requiresApiKey: false,
        usageReporting: true,
        defaultCacheTtlSec: 0,
      },
      health: async () => ({
        status: "ready",
        checkedAt: "2026-09-14T14:30:00.000Z",
      }),
      search: async () => ({ items: [candidate] }),
      resolve: async (resolvedCandidate, rendition) => ({
        candidate: resolvedCandidate,
        rendition,
      }),
      reportUsage,
    };
    const registry = new StockMediaProviderRegistry(
      [provider],
      memoryPersistence(),
    );
    await expect(
      registry.search("fixture", {
        query: "ocean",
        kind: "image",
        perPage: 6,
      }),
    ).rejects.toThrow("at most 5");
    await expect(
      registry.search("fixture", {
        query: "ocean",
        kind: "video",
        perPage: 1,
      }),
    ).rejects.toThrow("does not support video");
    await expect(
      registry.resolve("fixture", candidate, "large"),
    ).resolves.toMatchObject({ rendition: { id: "large" } });

    await registry.reportUsage("fixture", {
      schemaVersion: 1,
      resolvedAt: "2026-09-14T14:30:00.000Z",
      localAssetId: "asset-1",
      providerSnapshot: candidate,
      sourceRevision: {
        capturedAt: "2026-09-14T14:30:00.000Z",
        termsUrl: "https://example.test/terms",
      },
      contentHash: "a".repeat(64),
      selectedRendition: candidate.renderRenditions[0]!,
      usageEvent: { state: "pending" },
    });
    expect(reportUsage).toHaveBeenCalledTimes(1);
  });
});
