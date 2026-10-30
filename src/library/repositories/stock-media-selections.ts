import { AIError } from "@/providers/ai/types";
import { mediaRankingSource } from "./media-ranking-jobs";
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
  options?: { rankingJobId?: string; expectedSourceHash?: string },
): Promise<{ scene: SceneDTO; selection: StockMediaSelectionDTO }> {
  const snapshot = resolvedStockAssetSchema.parse(input);
  const provider = snapshot.providerSnapshot;
  if (provider.kind !== background.type) {
    throw new Error("Stock background kind must match the provider selection");
  }

  return prisma.$transaction(async (tx) => {
    const current = await tx.scene.findUnique({ where: { id: sceneId } });
    if (!current) throw new AIError("Scene not found", 404);
    const config = parseJsonColumn(current.layoutJson, sceneConfigSchema, {});
    if (config.locks?.scene || config.locks?.assets)
      throw new AIError("The scene's visual scope is protected", 409);
    if (options?.rankingJobId) {
      const job = await tx.mediaRankingJob.findFirst({
        where: {
          id: options.rankingJobId,
          scriptId: current.scriptId,
          sceneId,
          state: "ready",
        },
      });
      if (
        !job ||
        job.sourceHash !== options.expectedSourceHash ||
        (await mediaRankingSource(current.scriptId, tx)).sourceHash !==
          job.sourceHash
      )
        throw new AIError(
          "The film changed since scoring; review current candidates",
          409,
        );
    }
    if (snapshot.localAssetId) {
      const asset = await tx.asset.findUnique({
        where: { id: snapshot.localAssetId },
        select: { type: true },
      });
      if (!asset || asset.type !== provider.kind)
        throw new Error(
          `Local stock asset must reference an existing ${provider.kind} asset`,
        );
    }
    config.background = background;
    config.mediaPreference = provider.kind;
    const scene = await tx.scene.update({
      where: { id: sceneId },
      data: { layoutJson: JSON.stringify(config) },
    });
    const data = {
      providerId: provider.providerId,
      providerAssetId: provider.providerAssetId,
      kind: provider.kind,
      snapshotJson: JSON.stringify(snapshot),
      localAssetId: snapshot.localAssetId ?? null,
    };
    const selection = await tx.stockMediaSelection.upsert({
      where: { sceneId },
      create: { sceneId, ...data },
      update: data,
    });
    return { scene: toSceneDTO(scene), selection: toDTO(selection) };
  });
}

/** Clear the visible background and selection metadata without deleting cached media. */
export async function clearSceneStockMedia(sceneId: string): Promise<SceneDTO> {
  return prisma.$transaction(async (tx) => {
    const current = await tx.scene.findUnique({ where: { id: sceneId } });
    if (!current) throw new AIError("Scene not found", 404);
    const config = parseJsonColumn(current.layoutJson, sceneConfigSchema, {});
    if (config.locks?.scene || config.locks?.assets)
      throw new AIError("The scene's visual scope is protected", 409);
    delete config.background;
    config.mediaPreference = "none";
    const scene = await tx.scene.update({
      where: { id: sceneId },
      data: { layoutJson: JSON.stringify(config) },
    });
    await tx.stockMediaSelection.deleteMany({ where: { sceneId } });
    return toSceneDTO(scene);
  });
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

/** Fresh batched stock snapshots for revision polling. */
export async function listScriptsStockMediaSelections(scriptIds: string[]) {
  const selections = await prisma.stockMediaSelection.findMany({
    where: { scene: { scriptId: { in: scriptIds } } },
    include: { scene: { select: { order: true, scriptId: true } } },
  });
  const result = new Map<
    string,
    Array<{ sceneId: string; snapshot: ResolvedStockAsset }>
  >();
  for (const selection of selections.sort(
    (a, b) => a.scene.order - b.scene.order,
  )) {
    const list = result.get(selection.scene.scriptId) ?? [];
    list.push({
      sceneId: selection.sceneId,
      snapshot: resolvedStockAssetSchema.parse(
        JSON.parse(selection.snapshotJson),
      ),
    });
    result.set(selection.scene.scriptId, list);
  }
  return result;
}
