import { createHash } from "node:crypto";
import type { Prisma, MediaRankingJob as Row } from "@prisma/client";
import { prisma } from "../db";
import { filmCanonicalJson } from "@/production/film-plan";
import {
  mediaVisionJobSchema,
  mediaVisionRequestSchema,
  type MediaVisionRequest,
} from "@/production/media-vision";
import { AIError } from "@/providers/ai/types";
import { parseJsonColumn, sceneConfigSchema } from "../schemas";
export function mapMediaRankingJob(row: Row) {
  return mediaVisionJobSchema.parse({
    id: row.id,
    scriptId: row.scriptId,
    sceneId: row.sceneId,
    sourceHash: row.sourceHash,
    state: row.state,
    callsUsed: row.callsUsed,
    deadlineAt: row.deadlineAt.toISOString(),
    error: row.error,
    request: JSON.parse(row.requestJson),
    candidates: JSON.parse(row.candidatesJson ?? "[]"),
    assessments: JSON.parse(row.assessmentsJson ?? "[]"),
  });
}
export async function mediaRankingSource(
  scriptId: string,
  tx: Prisma.TransactionClient = prisma,
) {
  const row = await tx.script.findUnique({
    where: { id: scriptId },
    select: {
      id: true,
      width: true,
      height: true,
      brandOverrides: true,
      scenes: {
        orderBy: [{ order: "asc" }, { id: "asc" }],
        select: {
          id: true,
          order: true,
          text: true,
          spokenText: true,
          layoutJson: true,
          assetRefs: true,
        },
      },
    },
  });
  if (!row) throw new AIError("Script not found", 404);
  return {
    row,
    sourceHash: createHash("sha256")
      .update(filmCanonicalJson(row))
      .digest("hex"),
  };
}
export async function createMediaRankingJob(
  scriptId: string,
  request: MediaVisionRequest,
) {
  const fingerprint = createHash("sha256")
      .update(filmCanonicalJson({ scriptId, request }))
      .digest("hex"),
    identity = createHash("sha256")
      .update(request.idempotencyKey)
      .digest("hex");
  return prisma.$transaction(async (tx) => {
    const prior = await tx.mediaRankingJob.findUnique({
      where: { idempotencyKey: request.idempotencyKey },
    });
    if (prior) {
      if (prior.fingerprint !== fingerprint)
        throw new AIError("This ranking key belongs to different inputs", 409);
      return mapMediaRankingJob(prior);
    }
    const active = await tx.mediaRankingJob.findFirst({
      where: {
        scriptId,
        sceneId: request.sceneId,
        state: { in: ["queued", "running"] },
        deadlineAt: { gt: new Date() },
      },
    });
    if (active)
      throw new AIError(
        "Cancel the active scoring job before starting another",
        409,
      );
    const source = await mediaRankingSource(scriptId, tx),
      scene = source.row.scenes.find((s) => s.id === request.sceneId);
    if (!scene) throw new AIError("Scene is outside this film", 400);
    const locks = parseJsonColumn(
      scene.layoutJson,
      sceneConfigSchema,
      {},
    ).locks;
    if (locks?.scene || locks?.assets)
      throw new AIError("The scene's visual scope is protected", 409);
    if (source.sourceHash !== request.expectedHash)
      throw new AIError("The film changed; review candidates again", 409);
    return mapMediaRankingJob(
      await tx.mediaRankingJob.create({
        data: {
          id: `media-rank-${identity}`,
          idempotencyKey: request.idempotencyKey,
          fingerprint,
          scriptId,
          sceneId: scene.id,
          sourceHash: source.sourceHash,
          requestJson: JSON.stringify(request),
          deadlineAt: new Date(Date.now() + request.budget.deadlineMs),
        },
      }),
    );
  });
}
export async function getMediaRankingJob(scriptId: string, id: string) {
  const row = await prisma.mediaRankingJob.findFirst({
    where: { id, scriptId },
  });
  return row ? mapMediaRankingJob(row) : null;
}
export async function controlMediaRankingJob(
  scriptId: string,
  id: string,
  action: "cancel" | "resume",
) {
  return prisma.$transaction(async (tx) => {
    const row = await tx.mediaRankingJob.findFirst({ where: { id, scriptId } });
    if (!row) throw new AIError("Ranking job not found", 404);
    if (action === "cancel" && ["queued", "running"].includes(row.state))
      return mapMediaRankingJob(
        await tx.mediaRankingJob.update({
          where: { id },
          data: { state: "canceled", error: null },
        }),
      );
    if (
      action === "resume" &&
      !row.callsUsed &&
      ["failed", "canceled"].includes(row.state)
    ) {
      const source = await mediaRankingSource(scriptId, tx);
      if (source.sourceHash !== row.sourceHash)
        throw new AIError(
          "The film changed; submit a new explicit request",
          409,
        );
      const request = mediaVisionRequestSchema.parse(
        JSON.parse(row.requestJson),
      );
      return mapMediaRankingJob(
        await tx.mediaRankingJob.update({
          where: { id },
          data: {
            state: "queued",
            error: null,
            deadlineAt: new Date(Date.now() + request.budget.deadlineMs),
          },
        }),
      );
    }
    return mapMediaRankingJob(row);
  });
}
