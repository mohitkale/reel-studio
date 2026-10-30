import { prisma } from "./db";
import {
  getMediaRankingJob,
  mediaRankingSource,
} from "./repositories/media-ranking-jobs";
import { filmCanonicalJson } from "@/production/film-plan";
import {
  rankStockCandidates,
  selectionRanking,
} from "@/production/media-ranking";
import { orientationFromDims } from "@/lib/orientation";
import { AIError } from "@/providers/ai/types";
import type {
  StockMediaCandidate,
  NormalizedStockMediaSearchRequest,
} from "@/providers/stock/schemas";
/** Read only; the repository checks the source once more in the apply transaction. */
export async function rankingForSelection(
  sceneId: string,
  jobId: string,
  providerId: string,
  search: NormalizedStockMediaSearchRequest,
  candidates: StockMediaCandidate[],
  selectedId: string,
) {
  const scene = await prisma.scene.findUnique({
    where: { id: sceneId },
    select: { scriptId: true },
  });
  if (!scene) throw new AIError("Scene not found", 404);
  const job = await getMediaRankingJob(scene.scriptId, jobId);
  if (
    !job ||
    job.state !== "ready" ||
    job.sceneId !== sceneId ||
    job.request.stockProviderId !== providerId ||
    filmCanonicalJson(job.request.search) !== filmCanonicalJson(search)
  )
    throw new AIError("Vision ranking no longer matches this selection", 409);
  const source = await mediaRankingSource(scene.scriptId);
  if (source.sourceHash !== job.sourceHash)
    throw new AIError("The film changed since vision scoring", 409);
  const matched = job.candidates.map((original) => {
    const fresh = candidates.find(
      (item) => item.providerAssetId === original.providerAssetId,
    );
    if (!fresh || filmCanonicalJson(fresh) !== filmCanonicalJson(original))
      throw new AIError(
        "A candidate changed since scoring; review current results",
        409,
      );
    return fresh;
  });
  const target = source.row.scenes.find((s) => s.id === sceneId)!;
  const ranked = rankStockCandidates(matched, {
    query: search.query,
    orientation: orientationFromDims(source.row.width, source.row.height),
    sceneText: target.spokenText ?? target.text,
    vision: job.assessments,
  });
  const index = ranked.findIndex(
    (item) => item.candidate.providerAssetId === selectedId,
  );
  if (index < 0) throw new AIError("Selected candidate was not scored", 400);
  return {
    ranking: selectionRanking(ranked, index, search.query, true),
    scriptId: scene.scriptId,
    sourceHash: job.sourceHash,
  };
}
