import { z } from "zod";
import { prisma } from "@/library/db";
import { getAssetStore } from "@/library/storage";
import {
  parseJsonColumn,
  assetRefsSchema,
  sceneConfigSchema,
} from "@/library/schemas";
export async function getAssetUsage(id: string) {
  const asset = await prisma.asset.findUnique({ where: { id } });
  if (!asset) return null;
  const url = getAssetStore().url(asset.path);
  const scenes = await prisma.scene.findMany({
    select: {
      id: true,
      scriptId: true,
      text: true,
      assetRefs: true,
      layoutJson: true,
    },
  });
  const scripts = await prisma.script.findMany({
    where: { OR: [{ musicUrl: url }, { coverUrl: url }] },
    select: { id: true, name: true },
  });
  const podcasts = await prisma.podcast.findMany({
    where: { OR: [{ introMusicAssetId: id }, { outroMusicAssetId: id }] },
    select: { id: true, title: true },
  });
  return {
    assetId: id,
    provenance: parseJsonColumn(
      asset.meta,
      z.record(z.string(), z.unknown()).nullable(),
      null,
    ),
    scenes: scenes
      .filter(
        (scene) =>
          parseJsonColumn(scene.assetRefs, assetRefsSchema, []).includes(id) ||
          parseJsonColumn(scene.layoutJson, sceneConfigSchema, {}).background
            ?.url === url,
      )
      .map((scene) => ({
        id: scene.id,
        scriptId: scene.scriptId,
        label: scene.text.slice(0, 100),
      })),
    scripts,
    podcasts,
  };
}
