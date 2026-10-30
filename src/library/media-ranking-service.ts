import { prisma } from "./db";
import {
  createMediaRankingJob,
  getMediaRankingJob,
  mapMediaRankingJob,
  mediaRankingSource,
} from "./repositories/media-ranking-jobs";
import { mediaVisionRequestSchema } from "@/production/media-vision";
import { getStockMediaProviderRegistry } from "@/providers/stock/registry";
import { scoreStockPreviews } from "@/providers/stock/vision";
import { z } from "zod";
import { mediaVisionAssessmentSchema } from "@/production/media-ranking-contract";
import { stockCandidateKey } from "@/production/media-ranking";
import { AIError } from "@/providers/ai/types";
import { orientationFromDims } from "@/lib/orientation";
import { boundedGeneration } from "./bounded-generation";
export async function startMediaRanking(scriptId: string, raw: unknown) {
  return createMediaRankingJob(scriptId, mediaVisionRequestSchema.parse(raw));
}
export async function readMediaRanking(scriptId: string, id: string) {
  await prisma.mediaRankingJob.updateMany({
    where: {
      id,
      scriptId,
      state: { in: ["queued", "running"] },
      deadlineAt: { lte: new Date() },
    },
    data: {
      state: "failed",
      error:
        "Vision deadline expired. Only unspent work can resume; reserved calls are never replayed.",
    },
  });
  const job = await getMediaRankingJob(scriptId, id);
  if (!job) throw new AIError("Ranking job not found", 404);
  const source = await mediaRankingSource(scriptId);
  return { job, currentHash: source.sourceHash };
}
export async function readMediaRankingContext(
  scriptId: string,
  sceneId?: string,
) {
  const source = await mediaRankingSource(scriptId);
  if (sceneId && !source.row.scenes.some((scene) => scene.id === sceneId))
    throw new AIError("Scene is outside this film", 400);
  if (!sceneId) return { sourceHash: source.sourceHash };
  await prisma.mediaRankingJob.updateMany({
    where: {
      scriptId,
      sceneId,
      state: { in: ["queued", "running"] },
      deadlineAt: { lte: new Date() },
    },
    data: {
      state: "failed",
      error: "Vision deadline expired. Reserved calls are never replayed.",
    },
  });
  const row = await prisma.mediaRankingJob.findFirst({
    where: { scriptId, sceneId },
    orderBy: [{ createdAt: "desc" }, { updatedAt: "desc" }, { id: "desc" }],
  });
  return {
    sourceHash: source.sourceHash,
    job: row ? mapMediaRankingJob(row) : undefined,
  };
}
export async function runMediaRanking(
  scriptId: string,
  id: string,
  authorizeProvider: () => Promise<unknown>,
  dependencies: {
    registry?: ReturnType<typeof getStockMediaProviderRegistry>;
    score?: typeof scoreStockPreviews;
    configured?: () => boolean;
  } = {},
) {
  const claimed = await prisma.mediaRankingJob.updateMany({
    where: {
      id,
      scriptId,
      state: "queued",
      callsUsed: 0,
      deadlineAt: { gt: new Date() },
    },
    data: { state: "running" },
  });
  if (!claimed.count) return getMediaRankingJob(scriptId, id);
  const saved = (await getMediaRankingJob(scriptId, id))!,
    controller = new AbortController();
  const timer = setTimeout(
    () => controller.abort(),
    Math.max(0, Date.parse(saved.deadlineAt) - Date.now()),
  );
  let checking = false;
  const poll = setInterval(() => {
    if (checking) return;
    checking = true;
    void getMediaRankingJob(scriptId, id)
      .then((job) => {
        if (job?.state !== "running") controller.abort();
      })
      .catch(() => controller.abort())
      .finally(() => {
        checking = false;
      });
  }, 250);
  try {
    const request = saved.request,
      source = await mediaRankingSource(scriptId),
      scene = source.row.scenes.find((s) => s.id === request.sceneId);
    if (!scene || source.sourceHash !== saved.sourceHash)
      throw new Error("Ranking source changed");
    const registry = dependencies.registry ?? getStockMediaProviderRegistry();
    const search = await boundedGeneration(
      registry.search(
        request.stockProviderId,
        request.search,
        controller.signal,
      ),
      controller.signal,
    );
    const candidates = search.items.filter(
      (c) =>
        c.providerId === request.stockProviderId &&
        request.candidateIds.includes(c.providerAssetId),
    );
    if (
      candidates.length !== request.candidateIds.length ||
      new Set(candidates.map((c) => c.providerAssetId)).size !==
        candidates.length
    )
      throw new Error("Candidate scope changed");
    if (
      !(
        dependencies.configured ??
        (() => Boolean(process.env.OPENAI_API_KEY?.trim()))
      )()
    )
      throw new Error("Vision is not configured");
    controller.signal.throwIfAborted();
    await authorizeProvider();
    await prisma.$transaction(async (tx) => {
      const fresh = await mediaRankingSource(scriptId, tx);
      if (fresh.sourceHash !== saved.sourceHash)
        throw new Error("Ranking source changed");
      controller.signal.throwIfAborted();
      const reserved = await tx.mediaRankingJob.updateMany({
        where: {
          id,
          scriptId,
          state: "running",
          callsUsed: 0,
          deadlineAt: { gt: new Date() },
        },
        data: { callsUsed: 1, candidatesJson: JSON.stringify(candidates) },
      });
      if (!reserved.count) throw new Error("Ranking no longer active");
    });
    controller.signal.throwIfAborted();
    const assessments = await boundedGeneration(
      (dependencies.score ?? scoreStockPreviews)(
        {
          modelId: request.modelId,
          query: request.search.query,
          sceneText: scene.spokenText ?? scene.text,
          orientation: orientationFromDims(source.row.width, source.row.height),
          candidates,
          budget: request.budget,
        },
        controller.signal,
      ),
      controller.signal,
    );
    const checked = z
      .array(mediaVisionAssessmentSchema)
      .min(1)
      .max(6)
      .parse(assessments);
    const ids = new Set(candidates.map(stockCandidateKey));
    if (
      checked.length !== ids.size ||
      new Set(checked.map((a) => a.candidateId)).size !== ids.size ||
      checked.some((a) => !ids.has(a.candidateId))
    )
      throw new Error("Assessment scope changed");
    await prisma.$transaction(async (tx) => {
      controller.signal.throwIfAborted();
      const fresh = await mediaRankingSource(scriptId, tx);
      if (fresh.sourceHash !== saved.sourceHash)
        throw new Error("Ranking source changed");
      await tx.mediaRankingJob.updateMany({
        where: {
          id,
          scriptId,
          state: "running",
          callsUsed: 1,
          deadlineAt: { gt: new Date() },
        },
        data: {
          state: "ready",
          assessmentsJson: JSON.stringify(checked),
          error: null,
        },
      });
    });
  } catch {
    await prisma.mediaRankingJob.updateMany({
      where: { id, scriptId, state: "running" },
      data: {
        state: "failed",
        error:
          "Vision scoring stopped or failed validation. Metadata ranking remains available. No automatic paid retry was made.",
      },
    });
  } finally {
    clearTimeout(timer);
    clearInterval(poll);
  }
  return getMediaRankingJob(scriptId, id);
}
export { mediaRankingSource };
