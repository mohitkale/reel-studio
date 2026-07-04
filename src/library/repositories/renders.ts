import path from "node:path";
import { promises as fs } from "node:fs";

import type { RenderDTO } from "@/lib/dto";
import { getAssetStore } from "@/library/storage";
import { prisma } from "@/library/db";

function toDTO(r: {
  id: string;
  scriptId: string;
  voiceTakeId: string | null;
  name: string | null;
  status: string;
  quality?: string | null;
  progress: number;
  outputPath: string | null;
  error: string | null;
  createdAt: Date;
}): RenderDTO {
  return {
    id: r.id,
    scriptId: r.scriptId,
    voiceTakeId: r.voiceTakeId,
    name: r.name,
    status: r.status as RenderDTO["status"],
    quality: (r.quality as RenderDTO["quality"]) || "standard",
    progress: r.progress,
    outputUrl: r.outputPath ? getAssetStore().url(r.outputPath) : null,
    error: r.error,
    createdAt: r.createdAt.toISOString(),
  };
}

export async function renameRender(id: string, name: string): Promise<RenderDTO> {
  const row = await prisma.render.update({
    where: { id },
    data: { name: name.trim() || null },
  });
  return toDTO(row);
}

export async function createRender(input: {
  scriptId: string;
  voiceTakeId?: string;
  /** "pending_approval" gates the job behind a human click (MCP-originated). */
  status?: RenderDTO["status"];
  /** Optional label (e.g. the target format when repurposing). */
  name?: string;
  /** Speed/resolution tradeoff; defaults to "standard" (unchanged behavior). */
  quality?: RenderDTO["quality"];
}): Promise<RenderDTO> {
  const row = await prisma.render.create({
    data: {
      scriptId: input.scriptId,
      voiceTakeId: input.voiceTakeId ?? null,
      status: input.status ?? "queued",
      progress: 0,
      name: input.name ?? null,
      quality: input.quality && input.quality !== "standard" ? input.quality : null,
    },
  });
  return toDTO(row);
}

/**
 * Atomically transition a pending render to "queued" so a human approval can
 * start it. Returns the render only if it actually transitioned — a null result
 * means it was already approved (or not pending), so the caller must NOT start a
 * second render job (guards against double-fire).
 */
export async function approveRender(id: string): Promise<RenderDTO | null> {
  const res = await prisma.render.updateMany({
    where: { id, status: "pending_approval" },
    data: { status: "queued", progress: 0 },
  });
  if (res.count === 0) return null;
  return getRender(id);
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

export async function deleteRender(id: string): Promise<void> {
  const row = await prisma.render.findUnique({ where: { id } });
  if (!row) return;
  if (row.outputPath) {
    const filePath = path.join(process.cwd(), "media", row.outputPath);
    await fs.unlink(filePath).catch(() => {});
  }
  await prisma.render.delete({ where: { id } });
}
