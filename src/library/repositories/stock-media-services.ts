import { prisma } from "@/library/db";
import { downloadedStockMediaMetadataSchema } from "@/library/stock-media-download";
import {
  stockMediaQuotaStateSchema,
  type StockMediaQuotaState,
} from "@/providers/stock/schemas";

export interface StockMediaCacheRecord {
  requestHash: string;
  providerId: string;
  operation: string;
  requestJson: string;
  responseJson: string;
  expiresAt: Date;
}

export interface StockMediaMaterializationRecord {
  requestHash: string;
  providerId: string;
  providerAssetId: string;
  renditionId: string;
  sourceUrl: string;
  assetId: string;
  assetType: "image" | "video";
  storeKey: string;
  contentHash: string;
  metadataJson: string;
}

export interface SaveStockMediaMaterializationInput extends StockMediaMaterializationRecord {
  assetName: string;
}

export const stockMediaServiceRepository = {
  async getCache(requestHash: string): Promise<StockMediaCacheRecord | null> {
    return prisma.stockMediaResponseCache.findUnique({
      where: { requestHash },
    });
  },

  async putCache(record: StockMediaCacheRecord): Promise<void> {
    await prisma.stockMediaResponseCache.upsert({
      where: { requestHash: record.requestHash },
      create: record,
      update: {
        providerId: record.providerId,
        operation: record.operation,
        requestJson: record.requestJson,
        responseJson: record.responseJson,
        expiresAt: record.expiresAt,
      },
    });
  },

  async deleteCache(requestHash: string): Promise<void> {
    await prisma.stockMediaResponseCache.deleteMany({
      where: { requestHash },
    });
  },

  async deleteExpiredCache(now: Date): Promise<number> {
    const result = await prisma.stockMediaResponseCache.deleteMany({
      where: { expiresAt: { lte: now } },
    });
    return result.count;
  },

  async getQuota(providerId: string): Promise<StockMediaQuotaState | null> {
    const row = await prisma.stockMediaQuotaState.findUnique({
      where: { providerId },
    });
    if (!row) return null;
    return stockMediaQuotaStateSchema.parse({
      limit: row.limit ?? undefined,
      remaining: row.remaining ?? undefined,
      resetAt: row.resetAt?.toISOString(),
      observedAt: row.observedAt.toISOString(),
      metadata: row.metadataJson
        ? (JSON.parse(row.metadataJson) as unknown)
        : undefined,
    });
  },

  async putQuota(
    providerId: string,
    input: StockMediaQuotaState,
  ): Promise<void> {
    const quota = stockMediaQuotaStateSchema.parse(input);
    const observedAt = new Date(quota.observedAt);
    await prisma.$transaction(async (tx) => {
      const current = await tx.stockMediaQuotaState.findUnique({
        where: { providerId },
        select: { observedAt: true },
      });
      if (current && current.observedAt.getTime() > observedAt.getTime())
        return;
      await tx.stockMediaQuotaState.upsert({
        where: { providerId },
        create: {
          providerId,
          limit: quota.limit ?? null,
          remaining: quota.remaining ?? null,
          resetAt: quota.resetAt ? new Date(quota.resetAt) : null,
          observedAt,
          metadataJson: quota.metadata ? JSON.stringify(quota.metadata) : null,
        },
        update: {
          limit: quota.limit ?? null,
          remaining: quota.remaining ?? null,
          resetAt: quota.resetAt ? new Date(quota.resetAt) : null,
          observedAt,
          metadataJson: quota.metadata ? JSON.stringify(quota.metadata) : null,
        },
      });
    });
  },

  async getMaterialization(
    requestHash: string,
  ): Promise<StockMediaMaterializationRecord | null> {
    const row = await prisma.stockMediaMaterialization.findUnique({
      where: { requestHash },
      include: { asset: true },
    });
    if (!row) return null;
    if (row.asset.type !== "image" && row.asset.type !== "video") {
      throw new Error("Stock materialization references an invalid asset type");
    }
    return {
      requestHash: row.requestHash,
      providerId: row.providerId,
      providerAssetId: row.providerAssetId,
      renditionId: row.renditionId,
      sourceUrl: row.sourceUrl,
      assetId: row.assetId,
      assetType: row.asset.type,
      storeKey: row.asset.path,
      contentHash: row.contentHash,
      metadataJson: row.metadataJson,
    };
  },

  async putMaterialization(
    input: SaveStockMediaMaterializationInput,
  ): Promise<StockMediaMaterializationRecord> {
    const metadata = downloadedStockMediaMetadataSchema.parse(
      JSON.parse(input.metadataJson),
    );
    const metadataJson = JSON.stringify(metadata);
    const assetMeta = JSON.stringify({
      ...metadata,
      source: "stock-media",
      providerId: input.providerId,
      providerAssetId: input.providerAssetId,
      renditionId: input.renditionId,
      contentHash: input.contentHash,
    });
    return prisma.$transaction(async (tx) => {
      const asset = await tx.asset.upsert({
        where: { id: input.assetId },
        create: {
          id: input.assetId,
          type: input.assetType,
          name: input.assetName,
          path: input.storeKey,
          meta: assetMeta,
        },
        update: {},
      });
      if (asset.type !== input.assetType || asset.path !== input.storeKey) {
        throw new Error("Immutable stock asset id collision");
      }

      const row = await tx.stockMediaMaterialization.upsert({
        where: { requestHash: input.requestHash },
        create: {
          requestHash: input.requestHash,
          providerId: input.providerId,
          providerAssetId: input.providerAssetId,
          renditionId: input.renditionId,
          sourceUrl: input.sourceUrl,
          assetId: asset.id,
          contentHash: input.contentHash,
          metadataJson,
        },
        update: {
          sourceUrl: input.sourceUrl,
          assetId: asset.id,
          contentHash: input.contentHash,
          metadataJson,
        },
      });
      return {
        requestHash: row.requestHash,
        providerId: row.providerId,
        providerAssetId: row.providerAssetId,
        renditionId: row.renditionId,
        sourceUrl: row.sourceUrl,
        assetId: row.assetId,
        assetType: input.assetType,
        storeKey: asset.path,
        contentHash: row.contentHash,
        metadataJson: row.metadataJson,
      };
    });
  },
};

export type StockMediaServiceRepository = typeof stockMediaServiceRepository;
