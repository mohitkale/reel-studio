import type { ScriptDTO } from "@/lib/dto";
import { prisma } from "@/library/db";
import { toSceneDTO, toTakeDTO } from "./map";

export async function getScript(id: string): Promise<ScriptDTO | null> {
  const script = await prisma.script.findUnique({
    where: { id },
    include: {
      scenes: { orderBy: { order: "asc" } },
      takes: { orderBy: { createdAt: "desc" } },
    },
  });
  if (!script) return null;

  return {
    id: script.id,
    projectId: script.projectId,
    name: script.name,
    fps: script.fps,
    scenes: script.scenes.map(toSceneDTO),
    takes: script.takes.map(toTakeDTO),
  };
}

export async function renameScript(id: string, name: string): Promise<void> {
  await prisma.script.update({ where: { id }, data: { name } });
}
