import type { StockMediaSelection } from "@prisma/client";

import type { SceneBackground, SceneDTO } from "@/lib/dto";
import { prisma } from "@/library/db";
import { parseJsonColumn, sceneConfigSchema } from "@/library/schemas";
import {
  resolvedStockAssetSchema,
  type ResolvedStockAsset,
  type StockMediaSelectionDTO,
} from "@/providers/stock/schemas";
import { toSceneDTO } from "./map";

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

/** Atomically apply a stock background and its immutable provider snapshot. */
export async function applyStockMediaSelection(
  sceneId: string,
  input: ResolvedStockAsset,
  background: SceneBackground,
): Promise<{ scene: SceneDTO; selection: StockMediaSelectionDTO }> {
  const snapshot = resolvedStockAssetSchema.parse(input);
  const provider = snapshot.providerSnapshot;
  if (provider.kind !== background.type) {
    throw new Error("Stock background kind must match the provider selection");
  }

  const current = await prisma.scene.findUnique({
    where: { id: sceneId },
    select: { layoutJson: true },
  });
  if (!current) throw new Error("Scene not found");
  const config = parseJsonColumn(current.layoutJson, sceneConfigSchema, {});
  config.background = background;
  config.mediaPreference = provider.kind;

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

  const [scene, selection] = await prisma.$transaction([
    prisma.scene.update({
      where: { id: sceneId },
      data: { layoutJson: JSON.stringify(config) },
    }),
    prisma.stockMediaSelection.upsert({
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
    }),
  ]);
  return { scene: toSceneDTO(scene), selection: toDTO(selection) };
}

/** Clear the visible background and selection metadata without deleting cached media. */
export async function clearSceneStockMedia(sceneId: string): Promise<SceneDTO> {
  const current = await prisma.scene.findUnique({
    where: { id: sceneId },
    select: { layoutJson: true },
  });
  if (!current) throw new Error("Scene not found");
  const config = parseJsonColumn(current.layoutJson, sceneConfigSchema, {});
  delete config.background;
  config.mediaPreference = "none";
  const [scene] = await prisma.$transaction([
    prisma.scene.update({
      where: { id: sceneId },
      data: {
        layoutJson: Object.keys(config).length ? JSON.stringify(config) : null,
      },
    }),
    prisma.stockMediaSelection.deleteMany({ where: { sceneId } }),
  ]);
  return toSceneDTO(scene);
}

export async function clearStockMediaSelection(sceneId: string): Promise<void> {
  await prisma.stockMediaSelection.deleteMany({ where: { sceneId } });
}

/** Immutable provider snapshots ordered with their owning script scenes. */
export async function listScriptStockMediaSelections(scriptId: string) {
  const selections = await prisma.stockMediaSelection.findMany({
    where: { scene: { scriptId } },
    include: { scene: { select: { order: true } } },
  });
  return selections
    .sort((left, right) => left.scene.order - right.scene.order)
    .map((selection) => ({
      sceneId: selection.sceneId,
      snapshot: resolvedStockAssetSchema.parse(
        JSON.parse(selection.snapshotJson),
      ),
    }));
}
