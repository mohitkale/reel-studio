import { createHash } from "node:crypto";
import type { Prisma } from "@prisma/client";
import type { SceneDTO } from "@/lib/dto";
import type { AIScene } from "@/providers/ai/types";
import { AIError } from "@/providers/ai/types";
import { prisma } from "@/library/db";
import type { AutomaticMediaDecision } from "@/library/automatic-stock-media";
import { mergeGeneratedScene } from "@/library/selective-scene-regeneration";

async function rewriteState(db: Prisma.TransactionClient, scriptId: string) {
  const row = await db.script.findUnique({
    where: { id: scriptId },
    include: {
      scenes: { orderBy: { order: "asc" } },
      project: { select: { videoEngine: true } },
    },
  });
  if (!row) throw new AIError("Script not found", 404);
  // Include values as well as timestamps: imported data can preserve timestamps.
  return createHash("sha256").update(JSON.stringify(row)).digest("hex");
}

export function captureSceneRewriteState(scriptId: string) {
  return rewriteState(prisma, scriptId);
}

export function assertSceneRewriteState(expected: string, actual: string) {
  if (actual !== expected)
    throw new AIError(
      "The storyboard changed during generation. Review the current scenes and try again.",
      409,
    );
}

/** Commit generated scenes and their stock metadata together, only on the same draft. */
export async function commitSceneRewrite(input: {
  scriptId: string;
  expectedState: string;
  targets: SceneDTO[];
  generated: AIScene[];
  mediaDecisions: AutomaticMediaDecision[];
  signal?: AbortSignal;
}) {
  if (input.signal?.aborted) throw new AIError("Generation canceled", 499);
  if (
    !input.targets.length ||
    input.targets.length > 20 ||
    input.generated.length !== input.targets.length ||
    input.mediaDecisions.length !== input.targets.length
  )
    throw new AIError(
      "The provider result does not match the bounded selection",
      502,
    );
  await prisma.$transaction(async (tx) => {
    assertSceneRewriteState(
      input.expectedState,
      await rewriteState(tx, input.scriptId),
    );
    if (input.signal?.aborted) throw new AIError("Generation canceled", 499);
    for (const [index, target] of input.targets.entries()) {
      const decision = input.mediaDecisions[index];
      await tx.scene.update({
        where: { id: target.id },
        data: mergeGeneratedScene(
          target,
          input.generated[index],
          decision.background,
        ),
      });
      const snapshot = decision.snapshot;
      if (!snapshot || target.locks?.assets) continue;
      const data = {
        providerId: snapshot.providerSnapshot.providerId,
        providerAssetId: snapshot.providerSnapshot.providerAssetId,
        kind: snapshot.providerSnapshot.kind,
        snapshotJson: JSON.stringify(snapshot),
        localAssetId: snapshot.localAssetId ?? null,
      };
      await tx.stockMediaSelection.upsert({
        where: { sceneId: target.id },
        create: { sceneId: target.id, ...data },
        update: data,
      });
    }
  });
}
