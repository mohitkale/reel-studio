import type { AssetDTO } from "@/lib/dto";
import { prisma } from "@/library/db";
import { getAssetStore } from "@/library/storage";
import { metaSchema, parseJsonColumn } from "../schemas";

function toAssetDTO(
  a: { id: string; type: string; name: string | null; path: string; meta: string | null; createdAt: Date }
): AssetDTO {
  return {
    id: a.id,
    type: a.type as AssetDTO["type"],
    name: a.name,
    url: getAssetStore().url(a.path),
    meta: a.meta ? parseJsonColumn(a.meta, metaSchema, null) as Record<string, unknown> | null : null,
    createdAt: a.createdAt.toISOString(),
  };
}

export async function listAssets(type?: string): Promise<AssetDTO[]> {
  const assets = await prisma.asset.findMany({
    where: type ? { type } : undefined,
    orderBy: { createdAt: "desc" },
  });
  return assets.map(toAssetDTO);
}

export async function getAsset(id: string): Promise<AssetDTO | null> {
  const asset = await prisma.asset.findUnique({ where: { id } });
  return asset ? toAssetDTO(asset) : null;
}

export async function createAsset(
  type: string,
  storeKey: string,
  name?: string,
  meta?: Record<string, unknown>,
): Promise<AssetDTO> {
  const asset = await prisma.asset.create({
    data: {
      type,
      path: storeKey,
      name: name ?? null,
      meta: meta ? JSON.stringify(meta) : null,
    },
  });
  return toAssetDTO(asset);
}

export async function deleteAsset(id: string): Promise<void> {
  const asset = await prisma.asset.findUnique({ where: { id } });
  if (!asset) return;
  await prisma.asset.delete({ where: { id } });
  await getAssetStore().delete(asset.path).catch(() => {});
}
