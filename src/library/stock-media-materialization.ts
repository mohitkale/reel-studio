import { createHash } from "node:crypto";
import path from "node:path";

import {
  downloadedStockMediaMetadataSchema,
  downloadStockMedia,
  type DownloadedStockMediaMetadata,
} from "@/library/stock-media-download";
import {
  stockMediaServiceRepository,
  type SaveStockMediaMaterializationInput,
  type StockMediaMaterializationRecord,
} from "@/library/repositories/stock-media-services";
import { getAssetStore, type AssetStore } from "@/library/storage";
import { stockMediaRequestHash } from "@/library/stock-media-cache";
import {
  resolvedStockAssetSchema,
  stockMediaCandidateSchema,
  stockMediaRenditionSchema,
  type ResolvedStockAsset,
  type StockMediaCandidate,
  type StockMediaRendition,
} from "@/providers/stock/schemas";

interface StockMediaMaterializationPersistence {
  getMaterialization(
    requestHash: string,
  ): Promise<StockMediaMaterializationRecord | null>;
  putMaterialization(
    input: SaveStockMediaMaterializationInput,
  ): Promise<StockMediaMaterializationRecord>;
}

export interface MaterializeStockMediaInput {
  candidate: StockMediaCandidate;
  rendition: StockMediaRendition;
  termsUrl: string;
  termsVersion?: string;
  providerUpdatedAt?: string;
  usageRequired?: boolean;
  signal?: AbortSignal;
}

export interface MaterializeStockMediaOptions {
  persistence?: StockMediaMaterializationPersistence;
  store?: AssetStore;
  now?: () => Date;
  download?: typeof downloadStockMedia;
}

const materializationsInFlight = new Map<string, Promise<ResolvedStockAsset>>();

function buildSnapshot(input: {
  candidate: StockMediaCandidate;
  rendition: StockMediaRendition;
  capturedAt: string;
  termsUrl: string;
  termsVersion?: string;
  providerUpdatedAt?: string;
  usageRequired: boolean;
  local?: { assetId: string; contentHash: string };
}): ResolvedStockAsset {
  return resolvedStockAssetSchema.parse({
    schemaVersion: 1,
    resolvedAt: input.capturedAt,
    localAssetId: input.local?.assetId,
    compliantRemoteUrl: input.local ? undefined : input.rendition.url,
    providerSnapshot: input.candidate,
    sourceRevision: {
      capturedAt: input.capturedAt,
      termsUrl: input.termsUrl,
      termsVersion: input.termsVersion,
      providerUpdatedAt: input.providerUpdatedAt,
    },
    contentHash: input.local?.contentHash,
    selectedRendition: input.rendition,
    usageEvent: {
      state: input.usageRequired ? "pending" : "not-required",
    },
  });
}

function materializationRequestHash(
  candidate: StockMediaCandidate,
  rendition: StockMediaRendition,
): string {
  return stockMediaRequestHash(candidate.providerId, "materialize", {
    providerAssetId: candidate.providerAssetId,
    kind: candidate.kind,
    renditionId: rendition.id,
    sourceUrl: rendition.url,
  });
}

async function readValidCachedMaterialization(
  record: StockMediaMaterializationRecord,
  store: AssetStore,
): Promise<{
  assetId: string;
  contentHash: string;
  metadata: DownloadedStockMediaMetadata;
} | null> {
  if (!(await store.exists(record.storeKey))) return null;
  const bytes = await store.get(record.storeKey).catch(() => null);
  if (!bytes) return null;
  const contentHash = createHash("sha256").update(bytes).digest("hex");
  if (
    contentHash !== record.contentHash ||
    record.assetId !== `stock-${record.contentHash}`
  ) {
    return null;
  }
  try {
    const metadata = downloadedStockMediaMetadataSchema.parse(
      JSON.parse(record.metadataJson),
    );
    if (metadata.kind !== record.assetType || metadata.bytes !== bytes.length) {
      return null;
    }
    return {
      assetId: record.assetId,
      contentHash,
      metadata,
    };
  } catch {
    return null;
  }
}

/** Resolve a provider rendition to a compliant hotlink or immutable local asset. */
export async function materializeStockMedia(
  input: MaterializeStockMediaInput,
  options: MaterializeStockMediaOptions = {},
): Promise<ResolvedStockAsset> {
  const candidate = stockMediaCandidateSchema.parse(input.candidate);
  const rendition = stockMediaRenditionSchema.parse(input.rendition);
  const selected = candidate.renderRenditions.find(
    (item) => item.id === rendition.id && item.url === rendition.url,
  );
  if (!selected) {
    throw new Error(
      "Stock materialization rendition is not in the provider snapshot",
    );
  }

  const capturedAt = (options.now ?? (() => new Date()))().toISOString();
  const common = {
    candidate,
    rendition,
    capturedAt,
    termsUrl: input.termsUrl,
    termsVersion: input.termsVersion,
    providerUpdatedAt: input.providerUpdatedAt,
    usageRequired: input.usageRequired ?? false,
  };
  if (candidate.acquisitionPolicy === "hotlink") return buildSnapshot(common);

  const requestHash = materializationRequestHash(candidate, rendition);
  const pending = materializationsInFlight.get(requestHash);
  if (pending) return pending;

  const persistence = options.persistence ?? stockMediaServiceRepository;
  const store = options.store ?? getAssetStore();
  const run = (async () => {
    const cached = await persistence.getMaterialization(requestHash);
    if (
      cached &&
      cached.providerId === candidate.providerId &&
      cached.providerAssetId === candidate.providerAssetId &&
      cached.renditionId === rendition.id &&
      cached.sourceUrl === rendition.url &&
      cached.assetType === candidate.kind
    ) {
      const valid = await readValidCachedMaterialization(cached, store);
      if (valid) {
        return buildSnapshot({
          ...common,
          local: {
            assetId: valid.assetId,
            contentHash: valid.contentHash,
          },
        });
      }
    }

    const downloaded = await (options.download ?? downloadStockMedia)(
      rendition,
      candidate.kind,
      { signal: input.signal },
    );
    if (!Buffer.isBuffer(downloaded.data)) {
      throw new Error("Stock materialization download did not return bytes");
    }
    const metadata = downloadedStockMediaMetadataSchema.parse(
      downloaded.metadata,
    );
    const contentHash = createHash("sha256")
      .update(downloaded.data)
      .digest("hex");
    const assetId = `stock-${contentHash}`;
    const storeKey = path.posix.join(
      "stock-media",
      `${contentHash}.${metadata.extension}`,
    );
    await store.put(storeKey, downloaded.data);
    const saved = await persistence.putMaterialization({
      requestHash,
      providerId: candidate.providerId,
      providerAssetId: candidate.providerAssetId,
      renditionId: rendition.id,
      sourceUrl: rendition.url,
      assetId,
      assetType: candidate.kind,
      storeKey,
      contentHash,
      metadataJson: JSON.stringify(metadata),
      assetName: `${candidate.creator} · ${candidate.providerId}`,
    });
    return buildSnapshot({
      ...common,
      local: { assetId: saved.assetId, contentHash: saved.contentHash },
    });
  })();
  materializationsInFlight.set(requestHash, run);
  try {
    return await run;
  } finally {
    if (materializationsInFlight.get(requestHash) === run) {
      materializationsInFlight.delete(requestHash);
    }
  }
}
