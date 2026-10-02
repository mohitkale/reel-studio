import { prisma } from "@/library/db";
import { captureVideoSnapshot } from "@/library/video-snapshot";
import { getRender } from "@/library/repositories/renders";
import { videoProductionJobInputSchema } from "@/production/jobs";
import type { StartRenderOptions } from "@/library/render-service";

/** Commit render and durable submission together, including deferred approval inputs. */
export async function submitEditorRender(
  input: Omit<StartRenderOptions, "renderId" | "prepared"> & {
    name?: string;
    approval?: boolean;
  },
) {
  const snapshot =
    input.snapshot ??
    (await captureVideoSnapshot(input.scriptId, input.voiceTakeId));
  const row = await prisma.$transaction(async (tx) => {
    const render = await tx.render.create({
      data: {
        scriptId: input.scriptId,
        voiceTakeId: input.voiceTakeId,
        name: input.name,
        quality: input.quality,
        status: input.approval ? "pending_approval" : "queued",
      },
    });
    const inputs = videoProductionJobInputSchema.parse({
      ...input,
      snapshot,
      renderId: render.id,
    });
    await tx.productionJob.create({
      data: {
        kind: "video",
        state: input.approval ? "awaiting_approval" : "queued",
        idempotencyKey: `editor-render:${render.id}`,
        inputSnapshot: JSON.stringify(inputs),
      },
    });
    return render;
  });
  return (await getRender(row.id))!;
}

export async function approveEditorRender(id: string, serverBaseUrl: string) {
  return prisma.$transaction(async (tx) => {
    const render = await tx.render.findUnique({ where: { id } });
    if (!render || render.status !== "pending_approval") return;
    const key = `editor-render:${id}`;
    const job = await tx.productionJob.findUnique({
      where: { idempotencyKey: key },
    });
    if (job && job.state !== "awaiting_approval")
      throw new Error("Render job cannot be approved in its current state");
    if (job)
      await tx.productionJob.update({
        where: { id: job.id },
        data: { state: "queued" },
      });
    else
      await tx.productionJob.create({
        data: {
          kind: "video",
          state: "queued",
          idempotencyKey: key,
          inputSnapshot: JSON.stringify(
            videoProductionJobInputSchema.parse({
              renderId: id,
              scriptId: render.scriptId,
              voiceTakeId: render.voiceTakeId ?? undefined,
              quality: render.quality ?? undefined,
              serverBaseUrl,
            }),
          ),
        },
      });
    await tx.render.update({
      where: { id },
      data: { status: "queued", progress: 0 },
    });
  });
}

/** Repair legacy orphan rows and project durable failures/cancellation onto editor cards. */
export async function reconcileRenderJobs() {
  const rows = await prisma.$queryRaw<
    Array<{ id: string; error: string | null }>
  >`
    SELECT r.id, COALESCE((SELECT COALESCE(j.error, 'Render canceled') FROM ProductionJob j
      WHERE json_valid(j.inputSnapshot) AND json_extract(j.inputSnapshot, '$.renderId') = r.id
      AND j.state IN ('failed', 'canceled') LIMIT 1), 'Render interrupted; submit an explicit retry') AS error
    FROM Render r WHERE r.status IN ('queued', 'bundling', 'rendering', 'pending_approval')
      AND (EXISTS (SELECT 1 FROM ProductionJob j WHERE json_valid(j.inputSnapshot)
        AND json_extract(j.inputSnapshot, '$.renderId') = r.id AND j.state IN ('failed', 'canceled'))
      OR (r.status <> 'pending_approval' AND julianday(r.createdAt) < julianday('now', '-30 seconds')
        AND NOT EXISTS (SELECT 1 FROM ProductionJob j WHERE json_valid(j.inputSnapshot)
          AND json_extract(j.inputSnapshot, '$.renderId') = r.id)))`;
  const errors = new Map<string, string[]>();
  for (const row of rows) {
    const error = row.error ?? "Render interrupted";
    errors.set(error, [...(errors.get(error) ?? []), row.id]);
  }
  for (const [error, ids] of errors)
    await prisma.render.updateMany({
      where: {
        id: { in: ids },
        status: { in: ["queued", "bundling", "rendering", "pending_approval"] },
      },
      data: { status: "error", error },
    });
}
