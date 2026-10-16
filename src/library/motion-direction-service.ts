import {
  defaultMotionSystem,
  type MotionSystem,
} from "@/production/motion-systems";
import { chapterPlanIssue } from "@/production/chapters";
import { AIError } from "@/providers/ai/types";
import { randomUUID } from "node:crypto";
import { collectSequenceSubjects } from "@/production/sequence-subjects";
import type { Subject } from "@/video/sequence-direction";
import { analyzeBeat } from "@/production/director";
import {
  inferSemanticGraphic,
  resolveSemanticGraphic,
  enrichSemanticSequence,
  semanticStorySource,
} from "@/production/semantic-direction";

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

/** Apply direction atomically. Structured endpoints come only from literal
 * on-screen copy; existing diagrams, media, locks and all content are preserved.
 */
export async function replanMotionDirection(
  scriptId: string,
  input: {
    ambition?: VisualAmbition;
    newVariation?: boolean;
    adaptiveRecipes?: boolean;
    sequenceDirection?: boolean;
    subjectRegistry?: Subject[];
    chapterMotifs?: boolean;
    system?: MotionSystem;
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
      adaptiveRecipes:
        input.adaptiveRecipes ?? overrides.motionPlan?.adaptiveRecipes,
      sequenceDirection:
        input.sequenceDirection ?? overrides.motionPlan?.sequenceDirection,
      subjectRegistry:
        input.subjectRegistry ?? overrides.motionPlan?.subjectRegistry,
      system:
        input.system ??
        overrides.motionPlan?.system ??
        defaultMotionSystem(
          overrides.visualTheme?.id,
          overrides.productionPreset.id,
        ),
      ...(chapterMotifs !== undefined ? { chapterMotifs } : {}),
      seed: input.newVariation
        ? randomUUID()
        : (overrides.motionPlan?.seed ?? script.id),
      ambition:
        input.ambition ?? overrides.motionPlan?.ambition ?? "expressive",
    };
    const scenes = script.scenes.map(toSceneDTO);
    const structures = scenes.map((scene) => {
      if (
        scene.items?.length ||
        scene.chart ||
        scene.background?.url ||
        scene.visual
      )
        return undefined;
      const beat = analyzeBeat(scene.text);
      return beat.kind === "comparison" && beat.items ? beat : undefined;
    });
    const protectedScene = (index: number) =>
      Boolean(
        scenes[index].locks?.scene ||
        (scenes[index].hideText ?? script.hideText),
      );
    const directedScenes = enrichSemanticSequence(
      scenes.map((scene) => ({
        ...scene,
        spokenText: scene.spokenText ?? undefined,
      })),
    );
    const storySource = semanticStorySource(scenes);
    if (settings.sequenceDirection)
      settings.subjectRegistry = collectSequenceSubjects(
        directedScenes,
        settings.subjectRegistry,
      );
    const graphics = directedScenes.map((scene, index) =>
      structures[index]
        ? undefined
        : resolveSemanticGraphic(
            {
              ...scene,
              spokenText: scene.spokenText ?? undefined,
              direction: {
                ...scene.direction,
                graphic:
                  scene.direction?.graphic ??
                  inferSemanticGraphic(
                    scene.text,
                    scene.spokenText ?? undefined,
                  ),
              },
            },
            storySource,
          ),
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
          role: structures[index] ? "comparison" : scene.role,
          layout: {
            width: script.width,
            height: script.height,
            duration: Math.max(
              3,
              Math.min(
                120,
                (scene.spokenText ?? scene.text).split(/\s+/).length / 2.5 + 1,
              ),
            ),
          },
          energy: overrides.energy,
          text: scene.text,
          spokenText: scene.spokenText ?? undefined,
          direction: graphics[index]
            ? {
                version: 1,
                role: scene.role ?? "explanation",
                composition: "authored",
                graphic: graphics[index],
              }
            : scene.direction,
          chart: scene.chart,
          items: scene.items ?? structures[index]?.items,
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
        before?.typeEntrance === after?.typeEntrance &&
        before?.system === after?.system &&
        before?.sequenceVersion === after?.sequenceVersion &&
        JSON.stringify(before?.decision) === JSON.stringify(after?.decision) &&
        !structures[index] &&
        JSON.stringify(scenes[index].direction?.graphic) ===
          JSON.stringify(graphics[index])
      )
        continue;
      const config = parseJsonColumn(
        row.layoutJson,
        sceneConfigSchema.passthrough(),
        {},
      );
      if (after) config.motion = after;
      else delete config.motion;
      if (graphics[index])
        config.direction = {
          version: 1,
          role: scenes[index].role ?? "explanation",
          composition: "authored",
          graphic: graphics[index],
        };
      if (
        structures[index] &&
        (after?.recipeId.startsWith("comparison-") ||
          after?.recipeId === "adaptive-comparison")
      ) {
        config.items = structures[index]!.items;
        config.role = "comparison";
        config.direction = {
          version: 1,
          role: "comparison",
          composition: "authored",
        };
      }
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
