import type { ScriptDTO } from "@/lib/dto";
import { serverDefaultTokens } from "@/lib/brand-defaults";
import {
  DEFAULT_VIDEO_ENGINE,
  isVideoEngineId,
  type VideoEngineId,
} from "@/engines/types";
import { prisma } from "@/library/db";
import { resolveBrandTokens, getDefaultBrandKit } from "./brandkits";
import { toSceneDTO, toTakeDTO } from "./map";

function resolveEngine(value: string | null | undefined): VideoEngineId {
  return value && isVideoEngineId(value) ? value : DEFAULT_VIDEO_ENGINE;
}

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
    width: script.width,
    height: script.height,
    videoEngine: resolveEngine(script.project.videoEngine),
    scenes: script.scenes.map(toSceneDTO),
    takes: script.takes.map(toTakeDTO),
    brandKitId: script.project.brandKitId,
    brandTokens: brandKit ? resolveBrandTokens(brandKit) : serverDefaultTokens,
    coverUrl: script.coverUrl,
    musicUrl: script.musicUrl,
    musicVolume: script.musicVolume,
    hideText: script.hideText,
    hideProgressBar: (script as unknown as { hideProgressBar: boolean }).hideProgressBar ?? false,
  };
}

export async function updateScript(
  id: string,
  data: {
    name?: string;
    coverUrl?: string | null;
    musicUrl?: string | null;
    musicVolume?: number;
    hideText?: boolean;
    hideProgressBar?: boolean;
  },
): Promise<void> {
  await prisma.script.update({
    where: { id },
    // Cast needed until Prisma client regenerates after next server restart.
    data: {
      ...(data.name !== undefined ? { name: data.name } : {}),
      ...(data.coverUrl !== undefined ? { coverUrl: data.coverUrl || null } : {}),
      ...(data.musicUrl !== undefined ? { musicUrl: data.musicUrl || null } : {}),
      ...(data.musicVolume !== undefined
        ? { musicVolume: Math.max(0, Math.min(100, Math.round(data.musicVolume))) }
        : {}),
      ...(data.hideText !== undefined ? { hideText: data.hideText } : {}),
      ...(data.hideProgressBar !== undefined ? { hideProgressBar: data.hideProgressBar } : {}),
    } as Parameters<typeof prisma.script.update>[0]["data"],
  });
}
