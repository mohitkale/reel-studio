import type { RenderDTO } from "@/lib/dto";
import { getAssetStore } from "@/library/storage";
import { prisma } from "@/library/db";

function toDTO(r: {
  id: string;
  scriptId: string;
  voiceTakeId: string | null;
  status: string;
  progress: number;
  outputPath: string | null;
  error: string | null;
  createdAt: Date;
}): RenderDTO {
  return {
    id: r.id,
    scriptId: r.scriptId,
    voiceTakeId: r.voiceTakeId,
    status: r.status as RenderDTO["status"],
    progress: r.progress,
    outputUrl: r.outputPath ? getAssetStore().url(r.outputPath) : null,
    error: r.error,
    createdAt: r.createdAt.toISOString(),
  };
}

export async function createRender(input: {
  scriptId: string;
  voiceTakeId?: string;
}): Promise<RenderDTO> {
  const row = await prisma.render.create({
    data: {
      scriptId: input.scriptId,
      voiceTakeId: input.voiceTakeId ?? null,
      status: "queued",
      progress: 0,
    },
  });
  return toDTO(row);
}

export async function listRenders(scriptId?: string): Promise<RenderDTO[]> {
  const rows = await prisma.render.findMany({
    where: scriptId ? { scriptId } : undefined,
    orderBy: { createdAt: "desc" },
    take: 50,
  });
  return rows.map(toDTO);
}

export async function getRender(id: string): Promise<RenderDTO | null> {
  const row = await prisma.render.findUnique({ where: { id } });
  return row ? toDTO(row) : null;
}

export async function updateRenderProgress(
  id: string,
  progress: number,
  status?: RenderDTO["status"],
): Promise<void> {
  await prisma.render.update({
    where: { id },
    data: { progress, ...(status ? { status } : {}) },
  });
}

export async function completeRender(
  id: string,
  outputPath: string,
): Promise<RenderDTO> {
  const row = await prisma.render.update({
    where: { id },
    data: { status: "done", progress: 1, outputPath },
  });
  return toDTO(row);
}

export async function failRender(
  id: string,
  error: string,
): Promise<RenderDTO> {
  const row = await prisma.render.update({
    where: { id },
    data: { status: "error", error: error.slice(0, 2000) },
  });
  return toDTO(row);
}
