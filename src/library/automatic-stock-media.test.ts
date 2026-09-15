import { describe, expect, it, vi } from "vitest";

import {
  deterministicStockCandidate,
  resolveAutomaticSceneMedia,
  resolvePreferredMediaKind,
} from "@/library/automatic-stock-media";
import type { StockMediaProviderRegistry } from "@/providers/stock/registry";
import type {
  ResolvedStockAsset,
  StockMediaCandidate,
} from "@/providers/stock/schemas";

function candidate(id: string): StockMediaCandidate {
  return {
    providerId: "pexels",
    providerAssetId: id,
    kind: "image",
    previewUrl: `https://images.example.test/${id}-preview.jpg`,
    sourcePageUrl: `https://www.example.test/${id}`,
    creator: "Creator",
    width: 1080,
    height: 1920,
    orientation: "portrait",
    mimeType: "image/jpeg",
    renderRenditions: [
      {
        id: "portrait",
        url: `https://images.example.test/${id}.jpg`,
        width: 1080,
        height: 1920,
        mimeType: "image/jpeg",
      },
    ],
    attribution: { text: "Photo by Creator", required: true },
    acquisitionPolicy: "download",
  };
}

function snapshot(item: StockMediaCandidate): ResolvedStockAsset {
  return {
    schemaVersion: 1,
    resolvedAt: "2026-09-15T07:00:00.000Z",
    localAssetId: "stock-local",
    contentHash: "b".repeat(64),
    providerSnapshot: item,
    selectedRendition: item.renderRenditions[0]!,
    sourceRevision: {
      capturedAt: "2026-09-15T07:00:00.000Z",
      termsUrl: "https://www.pexels.com/license/",
    },
    usageEvent: { state: "not-required" },
  };
}

describe("automatic stock-media selection", () => {
  it("applies explicit preferences before the AI kind", () => {
    expect(resolvePreferredMediaKind("image", "video")).toBe("image");
    expect(resolvePreferredMediaKind("none", "video")).toBeNull();
    expect(resolvePreferredMediaKind("auto", "video")).toBe("video");
    expect(resolvePreferredMediaKind("auto")).toBe("image");
  });

  it("chooses the same candidate for the same bounded intent", () => {
    const items = [candidate("one"), candidate("two"), candidate("three")];
    expect(deterministicStockCandidate(items, "ocean:portrait")).toEqual(
      deterministicStockCandidate(items, "ocean:portrait"),
    );
  });

  it("resolves through the fixed provider order and materializes a local asset", async () => {
    const item = candidate("one");
    const registry = {
      get: vi.fn((id: string) => ({
        id,
        label: id === "pexels" ? "Pexels" : id,
        capabilities: {
          kinds: ["image", "video"],
          maxPageSize: 80,
          usageReporting: false,
        },
      })),
      health: vi.fn(async (id: string) => ({
        status: id === "pexels" ? "ready" : "unconfigured",
      })),
      search: vi.fn(async () => ({ items: [item] })),
      resolve: vi.fn(async () => ({
        candidate: item,
        rendition: item.renderRenditions[0]!,
      })),
    } as unknown as StockMediaProviderRegistry;
    const materialize = vi.fn(async () => snapshot(item));

    const result = await resolveAutomaticSceneMedia(
      { backgroundQuery: "ocean waves", mediaKind: "video" },
      "portrait",
      "image",
      {
        seed: "scene-1",
        dependencies: {
          registry,
          materialize,
          getLocalAsset: async () => ({
            id: "stock-local",
            type: "image",
            name: "Stock",
            url: "/media/stock.jpg",
            meta: null,
            createdAt: "2026-09-15T07:00:00.000Z",
          }),
        },
      },
    );

    expect(registry.search).toHaveBeenCalledWith("pexels", {
      query: "ocean waves",
      kind: "image",
      orientation: "portrait",
      perPage: 12,
    });
    expect(result).toMatchObject({
      state: "selected",
      kind: "image",
      providerId: "pexels",
      attemptedProviders: ["pexels"],
      background: { type: "image", url: "/media/stock.jpg" },
    });
    expect(materialize).toHaveBeenCalledTimes(1);
  });

  it("keeps explicit media and makes disabled/no-provider fallbacks visible", async () => {
    await expect(
      resolveAutomaticSceneMedia(
        { backgroundQuery: "ocean" },
        "portrait",
        "auto",
        {
          explicitBackground: {
            type: "image",
            url: "/media/upload.jpg",
          },
        },
      ),
    ).resolves.toMatchObject({ state: "explicit", attemptedProviders: [] });

    await expect(
      resolveAutomaticSceneMedia(
        { backgroundQuery: "ocean" },
        "portrait",
        "none",
      ),
    ).resolves.toMatchObject({
      state: "disabled",
      message: expect.stringContaining("disabled"),
    });
  });
});
