import { prisma } from "@/library/db";
import { createVisualReview } from "@/library/visual-review";
import { planDirectorRepair } from "@/production/director-repair";
import type {
  VisualReviewRequest,
  VisualReviewResult,
} from "@/production/visual-review";
import { currentVideoRevisionHash } from "@/library/production-revision";
import { ProviderError } from "@/providers/voice/types";

/** User-triggered loop: one initial capture, at most one repair and recapture.
 * No LLM/provider invocation, retries, duration changes or taste-score claims. */
export async function reviewAndRepairDirection(
  scriptId: string,
  input: VisualReviewRequest,
  serverBaseUrl: string,
  signal?: AbortSignal,
): Promise<VisualReviewResult> {
  const revision = await currentVideoRevisionHash(scriptId, input.voiceTakeId);
  const scenes = await prisma.scene.findMany({
    where: { scriptId, id: { in: input.sceneIds } },
  });
  const initial = await createVisualReview(
    scriptId,
    input,
    serverBaseUrl,
    signal,
  );
  if (input.repairPasses !== 1 || input.mode === "transition") return initial;
  signal?.throwIfAborted();
  if (
    (await currentVideoRevisionHash(scriptId, input.voiceTakeId)) !== revision
  )
    throw new ProviderError(
      "The video changed during review. Review its current revision before repairing.",
      409,
    );
  const repairedSceneIds = await prisma.$transaction(async (tx) => {
    const ids: string[] = [];
    for (const scene of scenes) {
      const config = planDirectorRepair(scene, initial.findings);
      if (!config) continue;
      const result = await tx.scene.updateMany({
        where: {
          id: scene.id,
          scriptId,
          text: scene.text,
          spokenText: scene.spokenText,
          templateId: scene.templateId,
          visual: scene.visual,
          hideText: scene.hideText,
          layoutJson: scene.layoutJson,
        },
        data: { layoutJson: JSON.stringify(config) },
      });
      if (result.count !== 1)
        throw new ProviderError(
          "The scene changed during repair. Review again.",
          409,
        );
      ids.push(scene.id);
    }
    return ids;
  });
  const sourceRevision = repairedSceneIds.length
    ? await currentVideoRevisionHash(scriptId, input.voiceTakeId)
    : revision;
  const result = repairedSceneIds.length
    ? await createVisualReview(
        scriptId,
        { ...input, repairPasses: 0 },
        serverBaseUrl,
        signal,
      )
    : initial;
  if (
    (await currentVideoRevisionHash(scriptId, input.voiceTakeId)) !==
    sourceRevision
  )
    throw new ProviderError(
      "The video changed during recapture. Review again.",
      409,
    );
  return {
    ...result,
    repair: {
      passesUsed: repairedSceneIds.length ? 1 : 0,
      paidCallsUsed: 0,
      sourceRevision,
      repairedSceneIds,
      unresolved: result.findings.length,
    },
  };
}
