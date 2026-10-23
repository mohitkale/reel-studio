import type { Prisma, PrismaClient, Scene } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/library/db";
import { ProviderError } from "@/providers/voice/types";

const snapshotSchema = z.object({
  text: z.string(),
  spokenText: z.string().nullable(),
  templateId: z.string(),
  emphasis: z.string().nullable(),
  visual: z.string().nullable(),
  layoutJson: z.string().nullable(),
  hideText: z.boolean().nullable(),
  selectedVoiceClipId: z.string().nullable(),
});
export function sceneEditSnapshot(scene: Scene) {
  return snapshotSchema.parse(scene);
}
export async function recordSceneEdit(
  tx: Prisma.TransactionClient,
  before: Scene,
  after: Scene,
) {
  const beforeJson = JSON.stringify(sceneEditSnapshot(before)),
    afterJson = JSON.stringify(sceneEditSnapshot(after));
  if (beforeJson === afterJson) return;
  await tx.sceneEdit.deleteMany({
    where: { scriptId: before.scriptId, undone: true },
  });
  await tx.sceneEdit.create({
    data: {
      scriptId: before.scriptId,
      sceneId: before.id,
      beforeJson,
      afterJson,
    },
  });
  const excess = await tx.sceneEdit.findMany({
    where: { scriptId: before.scriptId },
    orderBy: { sequence: "desc" },
    skip: 100,
    select: { sequence: true },
  });
  if (excess.length)
    await tx.sceneEdit.deleteMany({
      where: { sequence: { in: excess.map((row) => row.sequence) } },
    });
}
export async function listSceneHistory(scriptId: string) {
  return prisma.sceneEdit.findMany({
    where: { scriptId },
    orderBy: { sequence: "desc" },
    select: { sequence: true, sceneId: true, undone: true, createdAt: true },
    take: 100,
  });
}
export async function moveSceneHistory(
  scriptId: string,
  action: "undo" | "redo",
  client: PrismaClient = prisma,
) {
  return client.$transaction(async (tx) => {
    const entry = await tx.sceneEdit.findFirst({
      where: { scriptId, undone: action === "redo" },
      orderBy: { sequence: action === "undo" ? "desc" : "asc" },
    });
    if (!entry) throw new ProviderError(`Nothing to ${action}`, 409);
    const current = await tx.scene.findUnique({ where: { id: entry.sceneId } });
    if (!current || current.scriptId !== scriptId)
      throw new ProviderError(
        "This scene no longer exists. History cannot restore a deleted scene.",
        409,
      );
    const expected = action === "undo" ? entry.afterJson : entry.beforeJson;
    if (JSON.stringify(sceneEditSnapshot(current)) !== expected)
      throw new ProviderError(
        "This scene changed since this edit. Reload and review it before restoring history.",
        409,
      );
    const restore = snapshotSchema.parse(
      JSON.parse(action === "undo" ? entry.beforeJson : entry.afterJson),
    );
    if (
      restore.selectedVoiceClipId &&
      !(await tx.sceneVoiceClip.findFirst({
        where: { id: restore.selectedVoiceClipId, sceneId: current.id },
      }))
    )
      throw new ProviderError(
        "The saved voice clip is no longer available",
        409,
      );
    await tx.scene.update({ where: { id: current.id }, data: restore });
    if (restore.layoutJson !== current.layoutJson)
      await tx.stockMediaSelection.deleteMany({
        where: { sceneId: current.id },
      });
    await tx.sceneEdit.update({
      where: { sequence: entry.sequence },
      data: { undone: action === "undo" },
    });
    return entry.sceneId;
  });
}
