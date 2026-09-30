import type { SceneBackground, SceneDTO, ScriptDTO } from "@/lib/dto";
import type { AIScene } from "@/providers/ai/types";
import { DEFAULT_SCENE_LOCKS } from "@/library/schemas";
import { chapterPlanIssue } from "@/production/chapters";
import { AIError } from "@/providers/ai/types";

/** A chapter is a bounded provider call, with neighboring copy for continuity. */
export function prepareRegenerationScope(
  script: Pick<ScriptDTO, "scenes" | "chapterPlan">,
  input: { chapterId?: string; sceneIds?: string[] },
) {
  const ids = script.scenes.map((scene) => scene.id);
  let allowed = ids;
  let chapterTitle: string | undefined;
  if (input.chapterId) {
    const plan = script.chapterPlan;
    if (!plan) throw new AIError("Save a chapter outline first", 400);
    const issue = chapterPlanIssue(plan, ids);
    if (issue) throw new AIError(`Update the chapter outline: ${issue}`, 400);
    const index = plan.chapters.findIndex(
      (chapter) => chapter.id === input.chapterId,
    );
    if (index < 0)
      throw new AIError("The selected chapter no longer exists", 400);
    const chapter = plan.chapters[index];
    chapterTitle = chapter.title;
    allowed = ids.slice(
      ids.indexOf(chapter.firstSceneId),
      index + 1 < plan.chapters.length
        ? ids.indexOf(plan.chapters[index + 1].firstSceneId)
        : ids.length,
    );
  }
  const allowedSet = new Set(allowed);
  if (input.sceneIds?.some((id) => !allowedSet.has(id)))
    throw new AIError(
      "Selected scenes must belong to the requested chapter or script",
      400,
    );
  const targets = selectRegenerationTargets(
    script.scenes,
    input.sceneIds ?? allowed,
  );
  if (!targets.length)
    throw new AIError(
      "No unlocked scenes are selected. Unlock a scene or choose another one.",
      400,
    );
  if (targets.length > 20)
    throw new AIError(
      "Rewrite up to 20 scenes at a time. Choose a chapter or a smaller selection.",
      400,
    );
  const positions = targets.map((scene) => ids.indexOf(scene.id) + 1);
  const contextIds = new Set(
    input.chapterId ? allowed : targets.map((scene) => scene.id),
  );
  const contextScenes = script.scenes.filter(
    (scene, index) =>
      contextIds.has(scene.id) ||
      contextIds.has(ids[index - 1]) ||
      contextIds.has(ids[index + 1]),
  );
  const context = [
    ...(chapterTitle
      ? [
          `Chapter: ${chapterTitle}. Preserve continuity with the adjacent chapters.`,
        ]
      : []),
    ...contextScenes.map((scene) => {
      const line = describeSceneForAI(scene, ids.indexOf(scene.id));
      return contextIds.has(scene.id)
        ? line
        : `Context only (do not replace; excerpt): ${line.slice(0, 1000)}`;
    }),
  ].join("\n");
  if (context.length > 40_000)
    throw new AIError(
      "This selection contains too much copy for one rewrite. Select fewer scenes.",
      400,
    );
  return { targets, positions, context, chapterTitle };
}

export function selectRegenerationTargets(
  scenes: SceneDTO[],
  requestedIds?: string[],
): SceneDTO[] {
  const requested = requestedIds ? new Set(requestedIds) : null;
  return scenes.filter(
    (scene) =>
      (!requested || requested.has(scene.id)) &&
      !(scene.locks ?? DEFAULT_SCENE_LOCKS).scene,
  );
}

export function mergeGeneratedScene(
  existing: SceneDTO,
  generated: AIScene,
  generatedBackground?: SceneBackground,
) {
  const locks = existing.locks ?? DEFAULT_SCENE_LOCKS;
  const keepCopy = locks.copy;
  const config = {
    ...(locks.assets || !generatedBackground
      ? existing.background
        ? { background: existing.background }
        : {}
      : { background: generatedBackground }),
    ...(keepCopy
      ? existing.items?.length
        ? { items: existing.items }
        : {}
      : generated.items?.length
        ? { items: generated.items }
        : {}),
    ...(keepCopy
      ? existing.chart
        ? { chart: existing.chart }
        : {}
      : generated.chart
        ? { chart: generated.chart }
        : {}),
    mood: generated.mood ?? existing.mood,
    mediaPreference: existing.mediaPreference ?? "auto",
    ...(generated.musicMood || existing.musicMood
      ? { musicMood: generated.musicMood ?? existing.musicMood }
      : {}),
    ...(existing.role ? { role: existing.role } : {}),
    ...(existing.motion ? { motion: existing.motion } : {}),
    locks,
  };

  return {
    templateId: generated.templateId,
    text: keepCopy ? existing.text : generated.text,
    spokenText: keepCopy ? existing.spokenText : (generated.spokenText ?? null),
    emphasis: JSON.stringify(keepCopy ? existing.emphasis : generated.emphasis),
    visual: keepCopy ? (existing.visual ?? null) : (generated.visual ?? null),
    layoutJson: JSON.stringify(config),
  };
}

export function describeSceneForAI(scene: SceneDTO, index: number): string {
  const locks = scene.locks ?? DEFAULT_SCENE_LOCKS;
  const state = locks.scene
    ? "LOCKED WHOLE SCENE"
    : locks.copy
      ? "KEEP COPY"
      : "REPLACE";
  const spoken =
    scene.spokenText && scene.spokenText !== scene.text
      ? ` | voice: ${scene.spokenText}`
      : "";
  return `Scene ${index + 1} [${state}${locks.assets ? ", KEEP ASSETS" : ""}]: ${scene.text}${spoken}`;
}
