import { defaultSfxForTemplate, type SfxCue } from "@/lib/sfx-library";
import type { SceneDTO } from "@/lib/dto";
import { resolveMotionDirection } from "@/production/motion";

/**
 * Sparse, under-the-VO cue map.
 * One tasteful accent per scene max — stacking toy clicks reads amateur.
 */
export function buildTemplateSfxCues(
  scenes: Array<{ id: string; templateId: string }>,
): SfxCue[] {
  const cues: SfxCue[] = [];
  for (const scene of scenes) {
    const sfxId = defaultSfxForTemplate(scene.templateId);
    if (!sfxId) continue;

    // Quiet bed under narration. Risers even quieter.
    const volume = sfxId === "riser" ? 0.14 : sfxId === "click" ? 0.1 : 0.16;

    cues.push({
      sceneId: scene.id,
      sfxId,
      // Land just after the visual punch, not on the first VO syllable.
      offsetSeconds: sfxId === "whoosh" || sfxId === "swipe" ? 0.02 : 0.12,
      volume,
      source: "automatic",
    });
  }
  return cues;
}

/** Curated event accents. Reading and image-led beats deliberately stay quiet. */
export function buildAutomaticSfxCues(
  scenes: SceneDTO[],
  hideText = false,
): SfxCue[] {
  return scenes.flatMap((scene) => {
    if (scene.hideText ?? hideText) return [];
    const motion = resolveMotionDirection(
      scene.motion,
      scene.text,
      scene.chart,
      Boolean(scene.visual),
      scene.items,
      scene.background,
    );
    if (!motion) return buildTemplateSfxCues([scene]);
    let suggestion:
      | { sfxId: SfxCue["sfxId"]; anchor: "reveal" | "impact"; volume: number }
      | undefined;
    switch (motion.recipeId) {
      case "type-impact":
        suggestion = { sfxId: "soft-hit", anchor: "impact", volume: 0.14 };
        break;
      case "data-spotlight":
        suggestion = { sfxId: "pop", anchor: "reveal", volume: 0.1 };
        break;
      case "data-bars":
      case "diagram-path":
        suggestion = { sfxId: "click", anchor: "reveal", volume: 0.08 };
        break;
      case "diagram-orbit":
        suggestion = { sfxId: "pop", anchor: "reveal", volume: 0.08 };
        break;
    }
    return suggestion
      ? [
          {
            sceneId: scene.id,
            sfxId: suggestion.sfxId,
            offsetSeconds: 0,
            volume: suggestion.volume,
            source: "automatic" as const,
            event: { ...motion, anchor: suggestion.anchor },
          },
        ]
      : [];
  });
}
