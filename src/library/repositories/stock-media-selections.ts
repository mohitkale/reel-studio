import type { StockMediaSelection } from "@prisma/client";

import { prisma } from "@/library/db";
import {
  resolvedStockAssetSchema,
  type ResolvedStockAsset,
  type StockMediaSelectionDTO,
} from "@/providers/stock/schemas";

function toDTO(selection: StockMediaSelection): StockMediaSelectionDTO {
  return {
    id: selection.id,
    sceneId: selection.sceneId,
    snapshot: resolvedStockAssetSchema.parse(
      JSON.parse(selection.snapshotJson),
    ),
    createdAt: selection.createdAt.toISOString(),
    updatedAt: selection.updatedAt.toISOString(),
  };
}

export async function getStockMediaSelection(
  sceneId: string,
): Promise<StockMediaSelectionDTO | null> {
  const selection = await prisma.stockMediaSelection.findUnique({
    where: { sceneId },
  });
  return selection ? toDTO(selection) : null;
}

export async function saveStockMediaSelection(
  sceneId: string,
  input: ResolvedStockAsset,
): Promise<StockMediaSelectionDTO> {
  const snapshot = resolvedStockAssetSchema.parse(input);
  const provider = snapshot.providerSnapshot;

  if (snapshot.localAssetId) {
    const asset = await prisma.asset.findUnique({
      where: { id: snapshot.localAssetId },
      select: { type: true },
    });
    if (!asset || asset.type !== provider.kind) {
      throw new Error(
        `Local stock asset must reference an existing ${provider.kind} asset`,
      );
    }
  }

  const selection = await prisma.stockMediaSelection.upsert({
    where: { sceneId },
    create: {
      sceneId,
      providerId: provider.providerId,
      providerAssetId: provider.providerAssetId,
      kind: provider.kind,
      snapshotJson: JSON.stringify(snapshot),
      localAssetId: snapshot.localAssetId ?? null,
    },
    update: {
      providerId: provider.providerId,
      providerAssetId: provider.providerAssetId,
      kind: provider.kind,
      snapshotJson: JSON.stringify(snapshot),
      localAssetId: snapshot.localAssetId ?? null,
    },
  });
  return toDTO(selection);
}

export async function clearStockMediaSelection(sceneId: string): Promise<void> {
  await prisma.stockMediaSelection.deleteMany({ where: { sceneId } });
}
