import type { SceneBackground, SceneDTO } from "@/lib/dto";
import type { AIScene } from "@/providers/ai/types";
import { DEFAULT_SCENE_LOCKS } from "@/library/schemas";

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
    ...(generated.musicMood || existing.musicMood
      ? { musicMood: generated.musicMood ?? existing.musicMood }
      : {}),
    ...(existing.role ? { role: existing.role } : {}),
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
