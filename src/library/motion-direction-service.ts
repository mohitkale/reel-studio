import { chapterPlanIssue } from "@/production/chapters";
import { AIError } from "@/providers/ai/types";
import { randomUUID } from "node:crypto";

import { prisma } from "@/library/db";
import { toSceneDTO } from "@/library/repositories/map";
import {
  brandOverridesSchema,
  parseJsonColumn,
  sceneConfigSchema,
} from "@/library/schemas";
import {
  planMotionSequence,
  type MotionPlanSettings,
  type VisualAmbition,
} from "@/production/motion-plan";

/** Apply direction atomically. The only scene field written is layoutJson.motion. */
export async function replanMotionDirection(
  scriptId: string,
  input: {
    ambition?: VisualAmbition;
    newVariation?: boolean;
    chapterMotifs?: boolean;
  },
) {
  return prisma.$transaction(async (tx) => {
    const script = await tx.script.findUnique({
      where: { id: scriptId },
      include: { scenes: { orderBy: { order: "asc" } } },
    });
    if (!script) return { state: "not_found" as const };
    const overrides = parseJsonColumn(
      script.brandOverrides,
      brandOverridesSchema,
      {},
    );
    if (!overrides.productionPreset) return { state: "legacy" as const };
    const chapterMotifs =
      input.chapterMotifs ?? overrides.motionPlan?.chapterMotifs;
    if (
      chapterMotifs &&
      (!overrides.chapterPlan ||
        chapterPlanIssue(
          overrides.chapterPlan,
          script.scenes.map((scene) => scene.id),
        ))
    )
      throw new AIError(
        "Save a valid chapter outline before using chapter type motifs.",
        400,
      );
    const settings: MotionPlanSettings = {
      version: "1.0.0",
      ...(chapterMotifs !== undefined ? { chapterMotifs } : {}),
      seed: input.newVariation
        ? randomUUID()
        : (overrides.motionPlan?.seed ?? script.id),
      ambition:
        input.ambition ?? overrides.motionPlan?.ambition ?? "expressive",
    };
    const scenes = script.scenes.map(toSceneDTO);
    const protectedScene = (index: number) =>
      Boolean(
        scenes[index].locks?.scene ||
        (scenes[index].hideText ?? script.hideText),
      );
    let chapterIndex = -1;
    const motions = planMotionSequence(
      scenes.map((scene, index) => {
        const chapterStart =
          overrides.chapterPlan?.chapters.some(
            (chapter) => chapter.firstSceneId === scene.id,
          ) ?? false;
        if (chapterStart) chapterIndex++;
        return {
          role: scene.role,
          text: scene.text,
          chart: scene.chart,
          items: scene.items,
          background: scene.background,
          hasVisualContent: Boolean(scene.visual),
          current: scene.motion,
          locked: protectedScene(index),
          chapterIndex: chapterIndex >= 0 ? chapterIndex : undefined,
          chapterStart,
        };
      }),
      settings,
    );
    const changedSceneIds: string[] = [];
    for (const [index, row] of script.scenes.entries()) {
      if (protectedScene(index)) continue;
      const before = scenes[index].motion;
      const after = motions[index];
      if (
        before?.recipeId === after?.recipeId &&
        before?.version === after?.version &&
        before?.typeEntrance === after?.typeEntrance
      )
        continue;
      const config = parseJsonColumn(
        row.layoutJson,
        sceneConfigSchema.passthrough(),
        {},
      );
      if (after) config.motion = after;
      else delete config.motion;
      await tx.scene.update({
        where: { id: row.id },
        data: { layoutJson: JSON.stringify(config) },
      });
      changedSceneIds.push(row.id);
    }
    await tx.script.update({
      where: { id: scriptId },
      data: {
        brandOverrides: JSON.stringify({ ...overrides, motionPlan: settings }),
      },
    });
    return {
      state: "planned" as const,
      changedSceneIds,
      protectedSceneCount: scenes.filter((_, index) => protectedScene(index))
        .length,
      settings,
    };
  });
}
