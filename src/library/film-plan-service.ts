import { captureVideoSnapshot } from "./video-snapshot";
import { createProductionRevision } from "./production-revision";
import { getScript } from "./repositories/scripts";
import { prisma } from "./db";
import { AIError } from "@/providers/ai/types";
import {
  filmPlanDocumentSchema,
  type FilmPlanDocument,
} from "@/production/film-plan-document";
import {
  filmDigest,
  filmPlanSource,
  filmPlanMatchesSource,
  withResolvedFilmPlan,
} from "@/production/film-plan";
import { videoSnapshotSchema } from "@/production/video-snapshot";

export async function readFilmPlanDocument(
  scriptId: string,
  options: { voiceTakeId?: string; revisionId?: string } = {},
): Promise<FilmPlanDocument> {
  if (options.revisionId) {
    const revision = await prisma.productionRevision.findFirst({
      where: { id: options.revisionId, scriptId },
    });
    if (!revision) throw new AIError("Production revision not found", 404);
    const snapshot = videoSnapshotSchema.parse(
      JSON.parse(revision.snapshotJson),
    );
    return filmPlanDocumentSchema.parse({
      kind: "reel-studio-film-plan",
      version: 1,
      snapshot: snapshot.filmPlan ? snapshot : withResolvedFilmPlan(snapshot),
    });
  }
  const script = await getScript(scriptId);
  if (!script) throw new AIError("Script not found", 404);
  if (
    options.voiceTakeId &&
    !script.takes.some((take) => take.id === options.voiceTakeId)
  )
    throw new AIError("Voice take does not belong to this script", 400);
  return filmPlanDocumentSchema.parse({
    kind: "reel-studio-film-plan",
    version: 1,
    snapshot: await captureVideoSnapshot(scriptId, options.voiceTakeId),
  });
}

/** Checkpoint the current design, never overwrite live scenes with imported JSON. */
export async function saveFilmPlanDocument(
  scriptId: string,
  document: FilmPlanDocument,
) {
  const parsed = filmPlanDocumentSchema.parse(document);
  const { snapshot } = parsed;
  if (snapshot.script.id !== scriptId || !filmPlanMatchesSource(snapshot))
    throw new AIError(
      "Film plan does not match its source or this script",
      400,
    );
  const current = await readFilmPlanDocument(scriptId, {
    voiceTakeId: snapshot.take?.id,
  });
  if (
    filmDigest(filmPlanSource(current.snapshot)) !==
    snapshot.filmPlan!.sourceHash
  )
    throw new AIError(
      "The script has changed. Reload its film plan before saving a revision.",
      409,
    );
  const revision = await createProductionRevision(snapshot);
  return { revisionId: revision.id, sourceHash: snapshot.filmPlan!.sourceHash };
}
