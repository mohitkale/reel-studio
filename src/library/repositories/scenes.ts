import type { SceneDTO } from "@/lib/dto";
import { prisma } from "@/library/db";
import { toSceneDTO } from "./map";

export async function addScene(
  scriptId: string,
  data: { text: string; templateId?: string },
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
    },
  });
  return toSceneDTO(scene);
}

export async function updateScene(
  id: string,
  data: { text?: string; templateId?: string; emphasis?: string[] },
): Promise<SceneDTO> {
  const scene = await prisma.scene.update({
    where: { id },
    data: {
      text: data.text,
      templateId: data.templateId,
      emphasis:
        data.emphasis !== undefined ? JSON.stringify(data.emphasis) : undefined,
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
