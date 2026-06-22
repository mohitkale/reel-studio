import type { ScriptDTO } from "@/lib/dto";
import { serverDefaultTokens } from "@/lib/brand-defaults";
import { prisma } from "@/library/db";
import { resolveBrandTokens } from "./brandkits";
import { toSceneDTO, toTakeDTO } from "./map";

export async function getScript(id: string): Promise<ScriptDTO | null> {
  const script = await prisma.script.findUnique({
    where: { id },
    include: {
      scenes: { orderBy: { order: "asc" } },
      takes: { orderBy: { createdAt: "desc" } },
      project: { include: { brandKit: true } },
    },
  });
  if (!script) return null;

  const brandKit = script.project.brandKit;

  return {
    id: script.id,
    projectId: script.projectId,
    name: script.name,
    fps: script.fps,
    scenes: script.scenes.map(toSceneDTO),
    takes: script.takes.map(toTakeDTO),
    brandKitId: script.project.brandKitId,
    brandTokens: brandKit ? resolveBrandTokens(brandKit) : serverDefaultTokens,
  };
}

export async function renameScript(id: string, name: string): Promise<void> {
  await prisma.script.update({ where: { id }, data: { name } });
}
