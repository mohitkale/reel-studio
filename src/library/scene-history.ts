import type { Prisma, PrismaClient, Scene } from "@prisma/client";
import { z } from "zod";
import {
  restoreStructuralHistory,
  restoreStoryboardHistory,
  scriptHistorySchema,
  scriptSettingsSnapshot,
} from "./structural-history";
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
  await recordHistory(tx, before.scriptId, before.id, beforeJson, afterJson);
}
export async function recordHistory(
  tx: Prisma.TransactionClient,
  scriptId: string,
  sceneId: string,
  beforeJson: string,
  afterJson: string,
) {
  if (beforeJson === afterJson) return;
  await tx.sceneEdit.deleteMany({
    where: { scriptId, undone: true },
  });
  await tx.sceneEdit.create({
    data: {
      scriptId,
      sceneId,
      beforeJson,
      afterJson,
    },
  });
  const excess = await tx.sceneEdit.findMany({
    where: { scriptId },
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
    const expectedJson = action === "undo" ? entry.afterJson : entry.beforeJson;
    const restoreJson = action === "undo" ? entry.beforeJson : entry.afterJson;
    const expectedDocument: unknown = JSON.parse(expectedJson),
      restoreDocument: unknown = JSON.parse(restoreJson);
    if (
      expectedDocument &&
      typeof expectedDocument === "object" &&
      "historyKind" in expectedDocument
    ) {
      if (expectedDocument.historyKind === "structure")
        await restoreStructuralHistory(
          tx,
          scriptId,
          entry.sceneId,
          expectedDocument,
          restoreDocument,
        );
      else if (expectedDocument.historyKind === "storyboard")
        await restoreStoryboardHistory(
          tx,
          scriptId,
          expectedDocument,
          restoreDocument,
        );
      else {
        const before = scriptHistorySchema.parse(expectedDocument),
          next = scriptHistorySchema.parse(restoreDocument);
        const current = await tx.script.findUnique({ where: { id: scriptId } });
        if (
          !current ||
          JSON.stringify(scriptSettingsSnapshot(current)) !==
            JSON.stringify(before)
        )
          throw new ProviderError(
            "Script settings changed since this edit. Reload before restoring history.",
            409,
          );
        await tx.script.update({
          where: { id: scriptId },
          data: next.settings,
        });
      }
      await tx.sceneEdit.update({
        where: { sequence: entry.sequence },
        data: { undone: action === "undo" },
      });
      return entry.sceneId;
    }
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
