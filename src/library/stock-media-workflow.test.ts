import { describe, expect, it, vi } from "vitest";

import type { SceneDTO } from "@/lib/dto";
import {
  clearSelectedSceneStockMedia,
  selectSceneStockMedia,
  selectSceneStockMediaSchema,
} from "@/library/stock-media-workflow";
import type { StockMediaProviderRegistry } from "@/providers/stock/registry";
import type {
  ResolvedStockAsset,
  StockMediaCandidate,
  StockMediaSelectionDTO,
} from "@/providers/stock/schemas";

function candidate(): StockMediaCandidate {
  return {
    providerId: "pexels",
    providerAssetId: "photo-42",
    kind: "image",
    previewUrl: "https://images.example.test/preview.jpg",
    sourcePageUrl: "https://www.example.test/photo-42",
    creator: "A Photographer",
    creatorUrl: "https://www.example.test/creator",
    width: 1080,
    height: 1920,
    orientation: "portrait",
    mimeType: "image/jpeg",
    renderRenditions: [
      {
        id: "portrait",
        url: "https://images.example.test/photo-42.jpg",
        width: 1080,
        height: 1920,
        mimeType: "image/jpeg",
      },
    ],
    attribution: {
      text: "Photo by A Photographer on Pexels",
      required: true,
      licenseName: "Pexels License",
    },
    acquisitionPolicy: "download",
  };
}

function snapshot(item = candidate()): ResolvedStockAsset {
  return {
    schemaVersion: 1,
    resolvedAt: "2026-09-15T01:00:00.000Z",
    localAssetId: "stock-asset",
    contentHash: "a".repeat(64),
    providerSnapshot: item,
    selectedRendition: item.renderRenditions[0]!,
    sourceRevision: {
      capturedAt: "2026-09-15T01:00:00.000Z",
      termsUrl: "https://www.pexels.com/license/",
    },
    usageEvent: { state: "not-required" },
  };
}

function scene(background?: SceneDTO["background"]): SceneDTO {
  return {
    id: "scene-1",
    scriptId: "script-1",
    order: 0,
    templateId: "stat-reveal",
    text: "Hello",
    spokenText: null,
    emphasis: [],
    hideText: null,
    selectedVoiceClipId: null,
    background,
  };
}

function selection(value = snapshot()): StockMediaSelectionDTO {
  return {
    id: "selection-1",
    sceneId: "scene-1",
    snapshot: value,
    createdAt: "2026-09-15T01:00:00.000Z",
    updatedAt: "2026-09-15T01:00:00.000Z",
  };
}

function dependencies(item = candidate()) {
  const registry = {
    get: vi.fn(() => ({ capabilities: { usageReporting: false } })),
    search: vi.fn(async () => ({ items: [item] })),
    resolve: vi.fn(async () => ({
      candidate: item,
      rendition: item.renderRenditions[0]!,
    })),
  } as unknown as StockMediaProviderRegistry;
  const resolved = snapshot(item);
  const applied = selection(resolved);
  return {
    registry,
    materialize: vi.fn(async () => resolved),
    apply: vi.fn(async (_sceneId, _snapshot, background) => ({
      scene: scene(background),
      selection: applied,
    })),
    clear: vi.fn(async () => scene()),
    getSelection: vi.fn(async () => applied),
    getLocalAsset: vi.fn(async () => ({
      id: "stock-asset",
      type: "image" as const,
      name: "Stock",
      url: "/media/stock.jpg",
      meta: null,
      createdAt: "2026-09-15T01:00:00.000Z",
    })),
    reportUsage: vi.fn(async () => applied),
  };
}

describe("stock-media selection workflow", () => {
  it("accepts identifiers only, re-searches server-side, and applies a local background", async () => {
    expect(() =>
      selectSceneStockMediaSchema.parse({
        providerId: "pexels",
        providerAssetId: "photo-42",
        search: { query: "ocean", kind: "image", orientation: "portrait" },
        candidate: { url: "https://attacker.invalid/file" },
      }),
    ).toThrow();

    const deps = dependencies();
    const result = await selectSceneStockMedia(
      "scene-1",
      {
        providerId: "pexels",
        providerAssetId: "photo-42",
        search: { query: "ocean", kind: "image", orientation: "portrait" },
        imageEffect: "pan-left",
      },
      deps,
    );

    expect(deps.registry.search).toHaveBeenCalledWith("pexels", {
      query: "ocean",
      kind: "image",
      orientation: "portrait",
      perPage: 20,
    });
    expect(deps.apply).toHaveBeenCalledWith(
      "scene-1",
      expect.objectContaining({ localAssetId: "stock-asset" }),
      { type: "image", url: "/media/stock.jpg", effect: "pan-left" },
    );
    expect(result.scene.background?.url).toBe("/media/stock.jpg");
  });

  it("rejects a selection that is absent from the repeated search", async () => {
    const deps = dependencies();
    await expect(
      selectSceneStockMedia(
        "scene-1",
        {
          providerId: "pexels",
          providerAssetId: "missing",
          search: { query: "ocean", kind: "image" },
        },
        deps,
      ),
    ).rejects.toMatchObject({ status: 409, providerId: "pexels" });
    expect(deps.materialize).not.toHaveBeenCalled();
  });

  it("keeps a selection and surfaces a warning when required usage reporting fails", async () => {
    const item = candidate();
    const deps = dependencies(item);
    const pending = {
      ...snapshot(item),
      usageEvent: { state: "pending" as const },
    };
    deps.materialize.mockResolvedValue(pending);
    const failed = selection({
      ...pending,
      usageEvent: { state: "failed", error: "provider unavailable" },
    });
    deps.getSelection.mockResolvedValue(failed);
    deps.reportUsage.mockRejectedValue(new Error("provider unavailable"));
    (deps.registry.get as ReturnType<typeof vi.fn>).mockReturnValue({
      capabilities: { usageReporting: true },
    });

    const result = await selectSceneStockMedia(
      "scene-1",
      {
        providerId: "pexels",
        providerAssetId: "photo-42",
        search: { query: "ocean", kind: "image" },
      },
      deps,
    );
    expect(result.selection.snapshot.usageEvent.state).toBe("failed");
    expect(result.usageWarning).toBe("provider unavailable");
    expect(deps.reportUsage).toHaveBeenCalledTimes(1);
  });

  it("clears scene selection state without deleting materialized assets", async () => {
    const deps = dependencies();
    await expect(
      clearSelectedSceneStockMedia("scene-1", deps),
    ).resolves.toEqual({ scene: scene() });
    expect(deps.clear).toHaveBeenCalledWith("scene-1");
    expect(deps.getLocalAsset).not.toHaveBeenCalled();
  });
});
