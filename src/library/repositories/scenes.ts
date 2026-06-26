import type { SceneDTO, SceneBackground } from "@/lib/dto";
import { prisma } from "@/library/db";
import { sceneConfigSchema, parseJsonColumn } from "../schemas";
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
  const scene = await prisma.scene.create({
    data: {
      scriptId,
      order: (last?.order ?? -1) + 1,
      text: data.text,
      templateId: data.templateId ?? "placeholder",
      visual: data.visual,
    },
  });
  return toSceneDTO(scene);
}

export async function updateScene(
  id: string,
  data: {
    text?: string;
    templateId?: string;
    emphasis?: string[];
    visual?: string | null;
    background?: SceneBackground | null;
    items?: string[] | null;
    /** null = inherit script default, true/false = explicit per-scene override. */
    hideText?: boolean | null;
  },
): Promise<SceneDTO> {
  // background + items live together in the layoutJson config blob; merge so
  // updating one never clobbers the other.
  let layoutJson: string | undefined;
  if (data.background !== undefined || data.items !== undefined) {
    const current = await prisma.scene.findUnique({
      where: { id },
      select: { layoutJson: true },
    });
    const config = parseJsonColumn(current?.layoutJson, sceneConfigSchema, {});
    if (data.background !== undefined) {
      if (data.background === null) delete config.background;
      else config.background = data.background;
    }
    if (data.items !== undefined) {
      if (data.items === null || data.items.length === 0) delete config.items;
      else config.items = data.items;
    }
    layoutJson = Object.keys(config).length ? JSON.stringify(config) : "";
  }

  const scene = await prisma.scene.update({
    where: { id },
    data: {
      text: data.text,
      templateId: data.templateId,
      emphasis:
        data.emphasis !== undefined ? JSON.stringify(data.emphasis) : undefined,
      visual: data.visual !== undefined ? (data.visual ?? null) : undefined,
      layoutJson: layoutJson !== undefined ? (layoutJson || null) : undefined,
      hideText: data.hideText !== undefined ? data.hideText : undefined,
    },
  });
  return toSceneDTO(scene);
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
