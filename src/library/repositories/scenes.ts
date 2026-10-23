import type { Prisma } from "@prisma/client";
import { structureSnapshot } from "@/library/structural-history";
import { recordHistory } from "@/library/scene-history";
import type { SceneDTO, SceneBackground, SceneChartData } from "@/lib/dto";
import { defaultTemplateIdForEngine } from "@/engines/registry";
import { isVideoEngineId, DEFAULT_VIDEO_ENGINE } from "@/engines/types";
import { prisma } from "@/library/db";
import { ProviderError } from "@/providers/voice/types";
import {
  sceneConfigSchema,
  parseJsonColumn,
  brandOverridesSchema,
} from "../schemas";
import type { SceneLocks } from "../schemas";
import type { MotionDirection } from "@/production/motion";
import type { MediaPreference } from "@/lib/media-preference";
import { toSceneDTO } from "./map";

export async function addScene(
  scriptId: string,
  data: { text: string; templateId?: string; visual?: string },
): Promise<SceneDTO> {
  const last = await prisma.scene.findFirst({
    where: { scriptId },
    orderBy: { order: "desc" },
    select: { order: true },
  });
  const script = await prisma.script.findUnique({
    where: { id: scriptId },
    select: { project: { select: { videoEngine: true } } },
  });
  const engine =
    script?.project.videoEngine && isVideoEngineId(script.project.videoEngine)
      ? script.project.videoEngine
      : DEFAULT_VIDEO_ENGINE;
  const scene = await prisma.scene.create({
    data: {
      scriptId,
      order: (last?.order ?? -1) + 1,
      text: data.text,
      templateId: data.templateId ?? defaultTemplateIdForEngine(engine),
      visual: data.visual,
    },
  });
  return toSceneDTO(scene);
}

export async function updateScene(
  id: string,
  data: {
    text?: string;
    /** null clears override (voice uses display text again). */
    spokenText?: string | null;
    templateId?: string;
    emphasis?: string[];
    visual?: string | null;
    background?: SceneBackground | null;
    mediaPreference?: MediaPreference;
    items?: string[] | null;
    /** Structured chart values; null clears them. */
    chart?: SceneChartData | null;
    /** null = inherit script default, true/false = explicit per-scene override. */
    hideText?: boolean | null;
    /** Emotional/visual tone; null clears it back to the deterministic per-scene default. */
    mood?: string | null;
    /** Free-text music vibe hint; null clears it. */
    musicMood?: string | null;
    /** Active clip in per_scene mode; null clears selection. */
    selectedVoiceClipId?: string | null;
    locks?: SceneLocks;
    /** null restores this scene's original preset/template treatment. */
    motion?: MotionDirection | null;
  },
  transaction?: Prisma.TransactionClient,
): Promise<SceneDTO> {
  const db = transaction ?? prisma;
  // Structured scene options live together in the layoutJson config
  // blob; merge so updating one never clobbers the others.
  let layoutJson: string | undefined;
  let clearStockSelection = false;
  if (
    data.background !== undefined ||
    data.mediaPreference !== undefined ||
    data.items !== undefined ||
    data.chart !== undefined ||
    data.mood !== undefined ||
    data.musicMood !== undefined ||
    data.locks !== undefined ||
    data.motion !== undefined ||
    data.templateId !== undefined
  ) {
    const current = await db.scene.findUnique({
      where: { id },
      select: {
        layoutJson: true,
        script: { select: { brandOverrides: true } },
      },
    });
    const config = parseJsonColumn(current?.layoutJson, sceneConfigSchema, {});
    if (data.background !== undefined) {
      const previousUrl = config.background?.url;
      if (data.background === null) delete config.background;
      else config.background = data.background;
      clearStockSelection =
        data.background === null || data.background.url !== previousUrl;
      if (data.background) config.mediaPreference = data.background.type;
    }
    if (data.mediaPreference !== undefined) {
      config.mediaPreference = data.mediaPreference;
      if (data.mediaPreference === "none") {
        delete config.background;
        clearStockSelection = true;
      }
    }
    if (data.items !== undefined) {
      if (data.items === null || data.items.length === 0) delete config.items;
      else config.items = data.items;
    }
    if (data.chart !== undefined) {
      if (data.chart === null) delete config.chart;
      else config.chart = data.chart;
    }
    if (data.mood !== undefined) {
      if (data.mood === null) delete config.mood;
      else config.mood = data.mood as typeof config.mood;
    }
    if (data.musicMood !== undefined) {
      if (data.musicMood === null) delete config.musicMood;
      else config.musicMood = data.musicMood;
    }
    if (data.locks !== undefined) config.locks = data.locks;
    if (data.motion !== undefined) {
      delete config.direction;
      if (data.motion === null) delete config.motion;
      else config.motion = data.motion;
    }
    // Freeze participation when a creator locks an already directed scene.
    // Older locked scenes are never opted in by the automatic replanner.
    const sequenceEnabled = parseJsonColumn(
      current?.script?.brandOverrides,
      brandOverridesSchema,
      {},
    ).motionPlan?.sequenceDirection;
    if ((data.motion || data.locks?.scene) && config.motion && sequenceEnabled)
      config.motion = { ...config.motion, sequenceVersion: 1 };
    if (data.templateId !== undefined) delete config.direction;
    layoutJson = Object.keys(config).length ? JSON.stringify(config) : "";
  }

  if (
    data.selectedVoiceClipId !== undefined &&
    data.selectedVoiceClipId !== null
  ) {
    const clip = await db.sceneVoiceClip.findUnique({
      where: { id: data.selectedVoiceClipId },
      select: { sceneId: true },
    });
    if (!clip || clip.sceneId !== id) {
      throw new ProviderError("Voice clip does not belong to this scene", 400);
    }
  }

  const update = db.scene.update({
    where: { id },
    data: {
      text: data.text,
      spokenText: data.spokenText !== undefined ? data.spokenText : undefined,
      templateId: data.templateId,
      emphasis:
        data.emphasis !== undefined ? JSON.stringify(data.emphasis) : undefined,
      visual: data.visual !== undefined ? (data.visual ?? null) : undefined,
      layoutJson: layoutJson !== undefined ? layoutJson || null : undefined,
      hideText: data.hideText !== undefined ? data.hideText : undefined,
      selectedVoiceClipId:
        data.selectedVoiceClipId !== undefined
          ? data.selectedVoiceClipId
          : undefined,
    },
  });
  const scene = transaction
    ? await update
    : clearStockSelection
      ? (
          await prisma.$transaction([
            update,
            prisma.stockMediaSelection.deleteMany({ where: { sceneId: id } }),
          ])
        )[0]
      : await update;
  if (transaction && clearStockSelection)
    await transaction.stockMediaSelection.deleteMany({
      where: { sceneId: id },
    });
  return toSceneDTO(scene);
}

/** Save manual edits and their undo snapshot together, so failures cannot lose history. */
export async function updateSceneWithHistory(
  id: string,
  data: Parameters<typeof updateScene>[1],
) {
  return prisma.$transaction(async (tx) => {
    const before = await tx.scene.findUnique({ where: { id } });
    if (!before) throw new ProviderError("Scene not found", 404);
    const snapshot = await structureSnapshot(tx, before.scriptId, id);
    const result = await updateScene(id, data, tx);
    await recordHistory(
      tx,
      before.scriptId,
      id,
      JSON.stringify(snapshot),
      JSON.stringify(await structureSnapshot(tx, before.scriptId, id)),
    );
    return result;
  });
}

export async function deleteScene(id: string): Promise<void> {
  await prisma.scene.delete({ where: { id } });
}

/** Persist a new scene order. `orderedIds` is the full list in display order. */
export async function reorderScenes(
  scriptId: string,
  orderedIds: string[],
): Promise<void> {
  await prisma.$transaction(
    orderedIds.map((id, index) =>
      prisma.scene.updateMany({
        where: { id, scriptId },
        data: { order: index },
      }),
    ),
  );
}

/** Manual structural operations retain full deleted-scene relationships. */
export async function addSceneWithHistory(
  scriptId: string,
  data: { text: string; templateId?: string; visual?: string },
) {
  return prisma.$transaction(async (tx) => {
    const script = await tx.script.findUnique({
      where: { id: scriptId },
      select: { project: { select: { videoEngine: true } } },
    });
    if (!script) throw new ProviderError("Script not found", 404);
    const before = await structureSnapshot(tx, scriptId);
    const engine = isVideoEngineId(script.project.videoEngine)
      ? script.project.videoEngine
      : DEFAULT_VIDEO_ENGINE;
    const scene = await tx.scene.create({
      data: {
        scriptId,
        order: Math.max(-1, ...before.order.map((s) => s.order)) + 1,
        ...data,
        templateId: data.templateId ?? defaultTemplateIdForEngine(engine),
      },
    });
    const after = await structureSnapshot(tx, scriptId, scene.id);
    await recordHistory(
      tx,
      scriptId,
      scene.id,
      JSON.stringify(before),
      JSON.stringify(after),
    );
    return toSceneDTO(scene);
  });
}
export async function deleteSceneWithHistory(id: string) {
  return prisma.$transaction(async (tx) => {
    const scene = await tx.scene.findUnique({ where: { id } });
    if (!scene) throw new ProviderError("Scene not found", 404);
    const before = await structureSnapshot(tx, scene.scriptId, id);
    await tx.scene.delete({ where: { id } });
    const after = await structureSnapshot(tx, scene.scriptId, id);
    await recordHistory(
      tx,
      scene.scriptId,
      id,
      JSON.stringify(before),
      JSON.stringify(after),
    );
  });
}
export async function reorderScenesWithHistory(
  scriptId: string,
  ids: string[],
) {
  return prisma.$transaction(async (tx) => {
    const before = await structureSnapshot(tx, scriptId);
    if (
      ids.length !== before.order.length ||
      new Set(ids).size !== ids.length ||
      ids.some((id) => !before.order.some((row) => row.id === id))
    )
      throw new ProviderError(
        "Supply each scene in this script exactly once",
        400,
      );
    for (const [order, id] of ids.entries())
      await tx.scene.update({ where: { id }, data: { order } });
    const after = await structureSnapshot(tx, scriptId);
    await recordHistory(
      tx,
      scriptId,
      "@order",
      JSON.stringify(before),
      JSON.stringify(after),
    );
  });
}
