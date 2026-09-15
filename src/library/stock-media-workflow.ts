import { z } from "zod";

import type { SceneBackground, SceneDTO } from "@/lib/dto";
import { getAsset } from "@/library/repositories/assets";
import {
  applyStockMediaSelection,
  clearSceneStockMedia,
  getStockMediaSelection,
} from "@/library/repositories/stock-media-selections";
import { materializeStockMedia } from "@/library/stock-media-materialization";
import { reportStockMediaSelectionUsage } from "@/library/stock-media-usage";
import {
  PEXELS_LICENSE_URL,
  selectPexelsRendition,
} from "@/providers/stock/pexels";
import {
  PIXABAY_LICENSE_URL,
  selectPixabayRendition,
} from "@/providers/stock/pixabay";
import {
  stockMediaSearchRequestSchema,
  stockProviderIdSchema,
  type ResolvedStockAsset,
  type StockMediaCandidate,
  type StockMediaSelectionDTO,
} from "@/providers/stock/schemas";
import {
  getStockMediaProviderRegistry,
  type StockMediaProviderRegistry,
} from "@/providers/stock/registry";
import { StockError } from "@/providers/stock/types";
import { UNSPLASH_API_GUIDELINES_URL } from "@/providers/stock/unsplash";

const imageEffectSchema = z.enum([
  "ken-burns",
  "pan-left",
  "pan-right",
  "pan-up",
  "pan-down",
]);

export const selectSceneStockMediaSchema = z
  .object({
    providerId: stockProviderIdSchema,
    providerAssetId: z.string().trim().min(1).max(2048),
    search: stockMediaSearchRequestSchema,
    imageEffect: imageEffectSchema.optional(),
  })
  .strict();

export type SelectSceneStockMediaInput = z.input<
  typeof selectSceneStockMediaSchema
>;

export interface SelectSceneStockMediaResult {
  scene: SceneDTO;
  selection: StockMediaSelectionDTO;
  usageWarning?: string;
}

interface StockMediaWorkflowDependencies {
  registry: StockMediaProviderRegistry;
  materialize: typeof materializeStockMedia;
  apply: typeof applyStockMediaSelection;
  clear: typeof clearSceneStockMedia;
  getSelection: typeof getStockMediaSelection;
  getLocalAsset: typeof getAsset;
  reportUsage: typeof reportStockMediaSelectionUsage;
}

const termsUrls: Record<string, string> = {
  unsplash: UNSPLASH_API_GUIDELINES_URL,
  pexels: PEXELS_LICENSE_URL,
  pixabay: PIXABAY_LICENSE_URL,
};

function defaultDependencies(): StockMediaWorkflowDependencies {
  return {
    registry: getStockMediaProviderRegistry(),
    materialize: materializeStockMedia,
    apply: applyStockMediaSelection,
    clear: clearSceneStockMedia,
    getSelection: getStockMediaSelection,
    getLocalAsset: getAsset,
    reportUsage: reportStockMediaSelectionUsage,
  };
}

function selectRendition(candidate: StockMediaCandidate) {
  if (candidate.providerId === "pexels")
    return selectPexelsRendition(candidate);
  if (candidate.providerId === "pixabay")
    return selectPixabayRendition(candidate);
  const rendition = candidate.renderRenditions[0];
  if (!rendition) {
    throw new StockError(
      "Stock candidate has no renderable rendition",
      502,
      candidate.providerId,
    );
  }
  return rendition;
}

function message(error: unknown): string {
  return error instanceof Error && error.message.trim()
    ? error.message.trim()
    : "Provider usage reporting failed";
}

async function backgroundForSnapshot(
  snapshot: ResolvedStockAsset,
  imageEffect: z.infer<typeof imageEffectSchema>,
  deps: StockMediaWorkflowDependencies,
): Promise<SceneBackground> {
  let url = snapshot.compliantRemoteUrl;
  if (snapshot.localAssetId) {
    const asset = await deps.getLocalAsset(snapshot.localAssetId);
    if (!asset || asset.type !== snapshot.providerSnapshot.kind) {
      throw new StockError(
        "Materialized stock asset is unavailable",
        500,
        snapshot.providerSnapshot.providerId,
      );
    }
    url = asset.url;
  }
  if (!url) {
    throw new StockError(
      "Resolved stock asset has no renderable URL",
      500,
      snapshot.providerSnapshot.providerId,
    );
  }
  return snapshot.providerSnapshot.kind === "image"
    ? { type: "image", url, effect: imageEffect, stock: true }
    : { type: "video", url, muted: true, stock: true };
}

/** Search again on the server, resolve, materialize and atomically select an asset. */
export async function selectSceneStockMedia(
  sceneId: string,
  rawInput: SelectSceneStockMediaInput,
  dependencies: Partial<StockMediaWorkflowDependencies> = {},
): Promise<SelectSceneStockMediaResult> {
  const input = selectSceneStockMediaSchema.parse(rawInput);
  const deps = { ...defaultDependencies(), ...dependencies };
  const provider = deps.registry.get(input.providerId);
  const result = await deps.registry.search(input.providerId, input.search);
  const candidate = result.items.find(
    (item) => item.providerAssetId === input.providerAssetId,
  );
  if (!candidate) {
    throw new StockError(
      "The selected stock item is no longer present in these search results",
      409,
      input.providerId,
    );
  }
  const selected = selectRendition(candidate);
  const resolution = await deps.registry.resolve(
    input.providerId,
    candidate,
    selected.id,
  );
  const termsUrl = termsUrls[input.providerId];
  if (!termsUrl) {
    throw new StockError(
      "Stock provider terms are unavailable",
      503,
      input.providerId,
    );
  }
  const snapshot = await deps.materialize({
    candidate: resolution.candidate,
    rendition: resolution.rendition,
    termsUrl,
    usageRequired: provider.capabilities.usageReporting,
  });
  const background = await backgroundForSnapshot(
    snapshot,
    input.imageEffect ?? "ken-burns",
    deps,
  );
  let applied = await deps.apply(sceneId, snapshot, background);
  let usageWarning: string | undefined;
  if (snapshot.usageEvent.state === "pending") {
    try {
      await deps.reportUsage(sceneId);
    } catch (error) {
      usageWarning = message(error);
    }
    const refreshed = await deps.getSelection(sceneId);
    if (refreshed) applied = { ...applied, selection: refreshed };
  }
  return { ...applied, ...(usageWarning ? { usageWarning } : {}) };
}

export async function clearSelectedSceneStockMedia(
  sceneId: string,
  dependencies: Partial<StockMediaWorkflowDependencies> = {},
): Promise<{ scene: SceneDTO }> {
  const deps = { ...defaultDependencies(), ...dependencies };
  return { scene: await deps.clear(sceneId) };
}
