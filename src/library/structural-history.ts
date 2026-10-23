import type { Prisma, Script } from "@prisma/client";
import { z } from "zod";
import { ProviderError } from "@/providers/voice/types";

const sceneSchema = z.object({
  id: z.string(),
  scriptId: z.string(),
  order: z.number().int(),
  templateId: z.string(),
  text: z.string(),
  spokenText: z.string().nullable(),
  emphasis: z.string().nullable(),
  visual: z.string().nullable(),
  layoutJson: z.string().nullable(),
  assetRefs: z.string().nullable(),
  hideText: z.boolean().nullable(),
  selectedVoiceClipId: z.string().nullable(),
});
const clipSchema = z.object({
  id: z.string(),
  scriptId: z.string(),
  sceneId: z.string(),
  providerId: z.string(),
  voiceId: z.string(),
  modelId: z.string().nullable(),
  text: z.string(),
  textHash: z.string(),
  audioPath: z.string(),
  durationFrames: z.number().int(),
  fps: z.number().int(),
  label: z.string().nullable(),
  isPlaceholder: z.boolean(),
  createdAt: z.coerce.date(),
});
const stockSchema = z.object({
  id: z.string(),
  sceneId: z.string(),
  providerId: z.string(),
  providerAssetId: z.string(),
  kind: z.string(),
  snapshotJson: z.string(),
  localAssetId: z.string().nullable(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});
const orderSchema = z.array(
  z.object({ id: z.string(), order: z.number().int() }),
);
export const structureSchema = z.object({
  historyKind: z.literal("structure"),
  order: orderSchema,
  scene: sceneSchema.nullable(),
  clips: z.array(clipSchema),
  stock: stockSchema.nullable(),
});
const scriptSchema = z.object({
  name: z.string(),
  coverUrl: z.string().nullable(),
  musicUrl: z.string().nullable(),
  musicVolume: z.number(),
  sfxEnabled: z.boolean(),
  sfxJson: z.string().nullable(),
  hideText: z.boolean(),
  hideProgressBar: z.boolean(),
  voiceMode: z.string(),
  brandOverrides: z.string().nullable(),
});
export const scriptHistorySchema = z.object({
  historyKind: z.literal("script"),
  settings: scriptSchema,
});
export function scriptSettingsSnapshot(script: Script) {
  return scriptHistorySchema.parse({ historyKind: "script", settings: script });
}
export async function structureSnapshot(
  tx: Prisma.TransactionClient,
  scriptId: string,
  sceneId?: string,
) {
  const order = await tx.scene.findMany({
    where: { scriptId },
    orderBy: [{ order: "asc" }, { id: "asc" }],
    select: { id: true, order: true },
  });
  const scene = sceneId
    ? await tx.scene.findUnique({ where: { id: sceneId } })
    : null;
  const clips = scene
    ? await tx.sceneVoiceClip.findMany({
        where: { sceneId },
        orderBy: { id: "asc" },
      })
    : [];
  const stock = scene
    ? await tx.stockMediaSelection.findUnique({ where: { sceneId } })
    : null;
  return structureSchema.parse({
    historyKind: "structure",
    order,
    scene,
    clips,
    stock,
  });
}
export async function restoreStructuralHistory(
  tx: Prisma.TransactionClient,
  scriptId: string,
  sceneId: string,
  expected: unknown,
  restore: unknown,
) {
  const before = structureSchema.parse(expected),
    next = structureSchema.parse(restore);
  const current = await structureSnapshot(
    tx,
    scriptId,
    sceneId === "@order" ? undefined : sceneId,
  );
  if (JSON.stringify(current) !== JSON.stringify(before))
    throw new ProviderError(
      "Storyboard changed since this edit. Reload before restoring history.",
      409,
    );
  if (
    next.order.some((row) => !row.id) ||
    (next.stock && next.stock.sceneId !== next.scene?.id) ||
    (before.scene && next.scene && before.scene.id !== next.scene.id) ||
    (next.scene?.selectedVoiceClipId &&
      !next.clips.some(
        (c) =>
          c.id === next.scene?.selectedVoiceClipId &&
          c.sceneId === next.scene?.id,
      )) ||
    (next.scene && next.scene.scriptId !== scriptId) ||
    next.clips.some(
      (clip) => clip.scriptId !== scriptId || clip.sceneId !== next.scene?.id,
    )
  )
    throw new ProviderError("Invalid history scope", 409);
  if (before.scene && !next.scene)
    await tx.scene.delete({ where: { id: before.scene.id } });
  if (!before.scene && next.scene) {
    const selected = next.scene.selectedVoiceClipId;
    await tx.scene.create({
      data: { ...next.scene, selectedVoiceClipId: null },
    });
    if (next.clips.length)
      await tx.sceneVoiceClip.createMany({ data: next.clips });
    if (selected)
      await tx.scene.update({
        where: { id: next.scene.id },
        data: { selectedVoiceClipId: selected },
      });
    if (next.stock) {
      if (
        next.stock.localAssetId &&
        !(await tx.asset.findUnique({ where: { id: next.stock.localAssetId } }))
      )
        throw new ProviderError(
          "The scene's saved stock asset is no longer available",
          409,
        );
      await tx.stockMediaSelection.create({ data: next.stock });
    }
  }
  if (before.scene && next.scene) {
    await tx.scene.update({
      where: { id: next.scene.id },
      data: { ...next.scene, selectedVoiceClipId: null },
    });
    await tx.sceneVoiceClip.deleteMany({ where: { sceneId: next.scene.id } });
    if (next.clips.length)
      await tx.sceneVoiceClip.createMany({ data: next.clips });
    await tx.scene.update({
      where: { id: next.scene.id },
      data: { selectedVoiceClipId: next.scene.selectedVoiceClipId },
    });
    await tx.stockMediaSelection.deleteMany({
      where: { sceneId: next.scene.id },
    });
    if (next.stock) {
      if (
        next.stock.localAssetId &&
        !(await tx.asset.findUnique({ where: { id: next.stock.localAssetId } }))
      )
        throw new ProviderError(
          "The scene's saved stock asset is no longer available",
          409,
        );
      await tx.stockMediaSelection.create({ data: next.stock });
    }
  }
  for (const row of next.order)
    await tx.scene.update({
      where: { id: row.id },
      data: { order: row.order },
    });
}

export const storyboardHistorySchema = z.object({
  historyKind: z.literal("storyboard"),
  settings: scriptSchema,
  scenes: z.array(sceneSchema),
  clips: z.array(clipSchema),
  stock: z.array(stockSchema),
});
export async function storyboardSnapshot(
  tx: Prisma.TransactionClient,
  scriptId: string,
) {
  const script = await tx.script.findUniqueOrThrow({ where: { id: scriptId } });
  const scenes = await tx.scene.findMany({
    where: { scriptId },
    orderBy: [{ order: "asc" }, { id: "asc" }],
  });
  const clips = await tx.sceneVoiceClip.findMany({
    where: { scriptId },
    orderBy: { id: "asc" },
  });
  const stock = await tx.stockMediaSelection.findMany({
    where: { sceneId: { in: scenes.map((s) => s.id) } },
    orderBy: { id: "asc" },
  });
  return storyboardHistorySchema.parse({
    historyKind: "storyboard",
    settings: script,
    scenes,
    clips,
    stock,
  });
}
export async function restoreStoryboardHistory(
  tx: Prisma.TransactionClient,
  scriptId: string,
  expected: unknown,
  restore: unknown,
) {
  const before = storyboardHistorySchema.parse(expected),
    next = storyboardHistorySchema.parse(restore);
  if (
    JSON.stringify(await storyboardSnapshot(tx, scriptId)) !==
    JSON.stringify(before)
  )
    throw new ProviderError(
      "Storyboard changed since this edit. Reload before restoring history.",
      409,
    );
  if (
    next.scenes.some((s) => s.scriptId !== scriptId) ||
    next.stock.some(
      (stock) => !next.scenes.some((s) => s.id === stock.sceneId),
    ) ||
    next.scenes.some(
      (scene) =>
        scene.selectedVoiceClipId &&
        !next.clips.some(
          (c) => c.id === scene.selectedVoiceClipId && c.sceneId === scene.id,
        ),
    ) ||
    next.clips.some(
      (c) =>
        c.scriptId !== scriptId || !next.scenes.some((s) => s.id === c.sceneId),
    )
  )
    throw new ProviderError("Invalid storyboard history scope", 409);
  await tx.scene.updateMany({
    where: { scriptId },
    data: { selectedVoiceClipId: null },
  });
  await tx.scene.deleteMany({ where: { scriptId } });
  if (next.scenes.length)
    await tx.scene.createMany({
      data: next.scenes.map((s) => ({ ...s, selectedVoiceClipId: null })),
    });
  if (next.clips.length)
    await tx.sceneVoiceClip.createMany({ data: next.clips });
  for (const scene of next.scenes)
    if (scene.selectedVoiceClipId)
      await tx.scene.update({
        where: { id: scene.id },
        data: { selectedVoiceClipId: scene.selectedVoiceClipId },
      });
  for (const stock of next.stock) {
    if (
      stock.localAssetId &&
      !(await tx.asset.findUnique({ where: { id: stock.localAssetId } }))
    )
      throw new ProviderError(
        "A saved storyboard asset is no longer available",
        409,
      );
    await tx.stockMediaSelection.create({ data: stock });
  }
  await tx.script.update({ where: { id: scriptId }, data: next.settings });
}
