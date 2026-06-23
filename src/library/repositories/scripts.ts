import type { ScriptDTO } from "@/lib/dto";
import { serverDefaultTokens } from "@/lib/brand-defaults";
import { prisma } from "@/library/db";
import { resolveBrandTokens, getDefaultBrandKit } from "./brandkits";
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

  const brandKit = script.project.brandKit ?? await getDefaultBrandKit();

  return {
    id: script.id,
    projectId: script.projectId,
    name: script.name,
    fps: script.fps,
    scenes: script.scenes.map(toSceneDTO),
    takes: script.takes.map(toTakeDTO),
    brandKitId: script.project.brandKitId,
    brandTokens: brandKit ? resolveBrandTokens(brandKit) : serverDefaultTokens,
    coverUrl: script.coverUrl,
  };
}

export async function updateScript(
  id: string,
  data: { name?: string; coverUrl?: string | null },
): Promise<void> {
  await prisma.script.update({
    where: { id },
    data: {
      ...(data.name !== undefined ? { name: data.name } : {}),
      ...(data.coverUrl !== undefined ? { coverUrl: data.coverUrl || null } : {}),
    },
  });
}
