import type { PrismaClient } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/library/db";
import { getAssetStore } from "@/library/storage";
import {
  parseJsonColumn,
  assetRefsSchema,
  sceneConfigSchema,
} from "@/library/schemas";
export async function getAssetUsage(id: string, client: PrismaClient = prisma) {
  const asset = await client.asset.findUnique({ where: { id } });
  if (!asset) return null;
  const url = getAssetStore().url(asset.path);
  const scenes = await client.scene.findMany({
    select: {
      id: true,
      scriptId: true,
      text: true,
      assetRefs: true,
      layoutJson: true,
      visual: true,
      stockMediaSelection: { select: { localAssetId: true } },
    },
  });
  const scripts = await client.script.findMany({
    where: { OR: [{ musicUrl: url }, { coverUrl: url }] },
    select: { id: true, name: true },
  });
  const podcasts = await client.podcast.findMany({
    where: { OR: [{ introMusicAssetId: id }, { outroMusicAssetId: id }] },
    select: { id: true, title: true },
  });
  const frozen: Array<{ kind: string; id: string; label: string }> = [];
  let frozenCount = 0;
  const references = (document: unknown): boolean => {
    const pending = [document];
    while (pending.length) {
      const value = pending.pop();
      if (
        typeof value === "string" &&
        (value === id || value === url || value === asset.path)
      )
        return true;
      if (typeof value === "string" && /^[\[{]/.test(value.trim())) {
        try {
          pending.push(JSON.parse(value));
        } catch {}
      }
      if (value && typeof value === "object")
        for (const item of Object.values(value)) pending.push(item);
    }
    return false;
  };
  for (const kind of ["revision", "job", "profile", "podcast-take"] as const) {
    let cursor: string | undefined;
    while (true) {
      const paging = {
        take: 25,
        orderBy: { id: "asc" as const },
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      };
      const rows =
        kind === "revision"
          ? await client.productionRevision
              .findMany({ ...paging, select: { id: true, snapshotJson: true } })
              .then((rows) =>
                rows.map((r) => ({ id: r.id, json: r.snapshotJson })),
              )
          : kind === "job"
            ? await client.productionJob
                .findMany({
                  ...paging,
                  select: { id: true, inputSnapshot: true },
                })
                .then((rows) =>
                  rows.map((r) => ({ id: r.id, json: r.inputSnapshot })),
                )
            : kind === "podcast-take"
              ? await client.podcastTake
                  .findMany({
                    ...paging,
                    select: { id: true, finishingJson: true },
                  })
                  .then((rows) =>
                    rows.map((r) => ({
                      id: r.id,
                      json: r.finishingJson ?? "{}",
                    })),
                  )
              : await client.factoryProfile
                  .findMany({
                    ...paging,
                    select: { id: true, documentJson: true },
                  })
                  .then((rows) =>
                    rows.map((r) => ({ id: r.id, json: r.documentJson })),
                  );
      for (const row of rows) {
        let document: unknown;
        try {
          document = JSON.parse(row.json);
        } catch {
          continue;
        }
        if (references(document)) {
          frozenCount++;
          if (frozen.length < 250)
            frozen.push({
              kind,
              id: row.id,
              label: `${kind} · ${row.id.slice(-10)}`,
            });
        }
      }
      if (rows.length < 25) break;
      cursor = rows[rows.length - 1].id;
    }
  }
  let sequence = 0;
  while (true) {
    const rows = await client.sceneEdit.findMany({
      where: { sequence: { gt: sequence } },
      orderBy: { sequence: "asc" },
      take: 25,
      select: { sequence: true, beforeJson: true, afterJson: true },
    });
    for (const row of rows) {
      let found = false;
      for (const json of [row.beforeJson, row.afterJson]) {
        try {
          found = found || references(JSON.parse(json));
        } catch {}
      }
      if (found) {
        frozenCount++;
        if (frozen.length < 250)
          frozen.push({
            kind: "edit-history",
            id: String(row.sequence),
            label: `Saved edit · ${row.sequence}`,
          });
      }
    }
    if (rows.length < 25) break;
    sequence = rows[rows.length - 1].sequence;
  }
  return {
    frozen,
    frozenCount,
    assetId: id,
    provenance: parseJsonColumn(
      asset.meta,
      z.record(z.string(), z.unknown()).nullable(),
      null,
    ),
    scenes: scenes
      .filter(
        (scene) =>
          scene.stockMediaSelection?.localAssetId === id ||
          scene.visual === url ||
          scene.visual === asset.path ||
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
