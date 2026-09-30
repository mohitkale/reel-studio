import { randomUUID } from "node:crypto";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/library/db";
import { brandOverridesSchema, parseJsonColumn } from "@/library/schemas";
import type { AutomaticMediaDecision } from "@/library/automatic-stock-media";
import {
  assertSceneRewriteState,
  captureSceneRewriteState,
} from "@/library/scene-rewrite-service";
import { prepareSceneAppendScope } from "@/library/scene-append-scope";
import { chapterPlanSchema } from "@/production/chapters";
import { AIError } from "@/providers/ai/types";
import { resolvedStockAssetSchema } from "@/providers/stock/schemas";

/** Append scenes, stock snapshots and the optional chapter boundary atomically. */
export async function commitSceneAppend(input: {
  scriptId: string;
  expectedState: string;
  chapterTitle?: string;
  scenes: Pick<
    Prisma.SceneCreateManyInput,
    "templateId" | "text" | "spokenText" | "emphasis" | "visual" | "layoutJson"
  >[];
  mediaDecisions: AutomaticMediaDecision[];
  signal?: AbortSignal;
}) {
  if (input.signal?.aborted) throw new AIError("Generation canceled", 499);
  if (
    !input.scenes.length ||
    input.scenes.length > 20 ||
    input.mediaDecisions.length !== input.scenes.length
  )
    throw new AIError(
      "The provider result does not match the bounded append",
      502,
    );
  return prisma.$transaction(async (tx) => {
    assertSceneRewriteState(
      input.expectedState,
      await captureSceneRewriteState(input.scriptId, tx),
    );
    const row = await tx.script.findUniqueOrThrow({
      where: { id: input.scriptId },
      include: { scenes: { orderBy: { order: "asc" } } },
    });
    const overrides = parseJsonColumn(
      row.brandOverrides,
      brandOverridesSchema,
      {},
    );
    prepareSceneAppendScope(
      { scenes: row.scenes, chapterPlan: overrides.chapterPlan },
      {
        chapterTitle: input.chapterTitle,
        sceneCount: input.scenes.length,
      },
    );
    const startOrder = (row.scenes.at(-1)?.order ?? -1) + 1;
    const ids: string[] = [];
    for (const [index, scene] of input.scenes.entries()) {
      if (input.signal?.aborted) throw new AIError("Generation canceled", 499);
      const saved = await tx.scene.create({
        data: { ...scene, scriptId: input.scriptId, order: startOrder + index },
      });
      ids.push(saved.id);
      const decision = input.mediaDecisions[index];
      if (!decision.snapshot || !decision.background) continue;
      const snapshot = resolvedStockAssetSchema.parse(decision.snapshot);
      if (snapshot.providerSnapshot.kind !== decision.background.type)
        throw new AIError(
          "Stock background kind must match the provider selection",
          502,
        );
      if (snapshot.localAssetId) {
        const asset = await tx.asset.findUnique({
          where: { id: snapshot.localAssetId },
          select: { type: true },
        });
        if (!asset || asset.type !== snapshot.providerSnapshot.kind)
          throw new AIError(
            "The selected stock asset is no longer available",
            409,
          );
      }
      await tx.stockMediaSelection.create({
        data: {
          sceneId: saved.id,
          providerId: snapshot.providerSnapshot.providerId,
          providerAssetId: snapshot.providerSnapshot.providerAssetId,
          kind: snapshot.providerSnapshot.kind,
          snapshotJson: JSON.stringify(snapshot),
          localAssetId: snapshot.localAssetId ?? null,
        },
      });
    }
    if (input.chapterTitle !== undefined) {
      const chapterPlan = chapterPlanSchema.parse({
        ...overrides.chapterPlan!,
        chapters: [
          ...overrides.chapterPlan!.chapters,
          {
            id: `chapter:${randomUUID()}`,
            title: input.chapterTitle,
            firstSceneId: ids[0],
          },
        ],
      });
      await tx.script.update({
        where: { id: input.scriptId },
        data: {
          brandOverrides: JSON.stringify({ ...overrides, chapterPlan }),
        },
      });
    }
    if (input.signal?.aborted) throw new AIError("Generation canceled", 499);
    return ids;
  });
}
