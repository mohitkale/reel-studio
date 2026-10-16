import type { MotionPlanScene, MotionPlanSettings } from "./motion-plan";
import {
  motionDirection,
  motionFallbackReason,
  type MotionDirection,
  type MotionRecipeId,
} from "./motion";
import { ADAPTIVE_RECIPES, isAdaptiveRecipe } from "@/video/adaptive-catalog";
import type { VisualProfile } from "@/video/sequence-direction";
import { resolveAdaptiveLayout, adaptiveInputReason } from "./adaptive-layout";
import {
  stableSubjectHash,
  collectSequenceSubjects,
  findSequenceSubject,
  sequenceSourceKey,
} from "./sequence-subjects";

export const SEQUENCE_SEARCH = {
  depth: 3,
  beamWidth: 6,
  maxCandidates: 6,
} as const;
type Choice = {
  motion: MotionDirection | undefined;
  profile: VisualProfile;
  subjects: string[];
  base: number;
};
const fallbackProfile: VisualProfile = {
  silhouette: "other",
  movement: "hold",
  density: "low",
  subjects: 0,
};
export function visualProfile(
  scene: MotionPlanScene,
  motion?: MotionDirection,
): VisualProfile {
  const id = motion?.recipeId ?? "",
    count = scene.items?.length || scene.chart?.labels.length || 1;
  return {
    silhouette: /comparison|list|grid|stack/.test(id)
      ? "panels"
      : /process|diagram/.test(id)
        ? "route"
        : /data|evidence/.test(id)
          ? "evidence"
          : /media/.test(id)
            ? "media"
            : /editorial|quote|quiet/.test(id)
              ? "reading"
              : id
                ? "focus"
                : "other",
    movement: /process|diagram|data-bars/.test(id)
      ? "draw"
      : /media-cinematic/.test(id)
        ? "zoom"
        : /quiet|editorial|quote/.test(id)
          ? "hold"
          : "rise",
    density:
      scene.text.length +
        (scene.items ?? scene.chart?.labels ?? []).join("").length >
      220
        ? "high"
        : count > 2
          ? "medium"
          : "low",
    subjects: count,
  };
}
/** Receding-horizon beam search: <= 3×6×6 evaluations per scene, no providers. */
export function directMotionSequence(
  scenes: readonly MotionPlanScene[],
  settings: MotionPlanSettings,
  history: readonly (MotionDirection | undefined)[],
  legacyChoices: Array<Array<MotionDirection | undefined>>,
) {
  const registry = collectSequenceSubjects(scenes, settings.subjectRegistry);
  const eligible = scenes.map((scene, index): Choice[] => {
    const supplied = legacyChoices[index];
    const protectedChoice =
      scene.locked || (supplied.length === 1 && !supplied[0]);
    const options = [...supplied];
    if (
      !protectedChoice &&
      settings.adaptiveRecipes &&
      !scene.hasVisualContent
    ) {
      for (const recipe of ADAPTIVE_RECIPES) {
        if (
          recipe.id === "adaptive-process" &&
          (scene.role !== "diagram" ||
            scene.current?.recipeId === "diagram-orbit")
        )
          continue;
        if (recipe.id === "adaptive-comparison" && scene.role !== "comparison")
          continue;
        if (!adaptiveInputReason(recipe.id, scene))
          options.push({
            ...motionDirection(recipe.id),
            system: settings.system ?? "precision",
          });
      }
    }
    const unique = new Map(options.map((m) => [m?.recipeId ?? "saved", m]));
    const subjects = (scene.items ?? [])
      .map((label) => findSequenceSubject(registry, label)?.id)
      .filter((id): id is string => Boolean(id));
    return [...unique.values()]
      .filter((m) => {
        if (protectedChoice || !m) return true;
        if (
          scene.current?.recipeId === "diagram-orbit" &&
          m.recipeId !== "diagram-orbit"
        )
          return false;
        if (
          motionFallbackReason(
            m,
            scene.text,
            scene.chart,
            Boolean(scene.hasVisualContent),
            scene.items,
            scene.background,
          )
        )
          return false;
        if (!isAdaptiveRecipe(m.recipeId)) return true;
        const layout = scene.layout ?? {
          width: 1080,
          height: 1920,
          duration: 8,
        };
        return Boolean(
          resolveAdaptiveLayout(
            {
              id: "candidate",
              templateId: "hf-statement",
              emphasis: [],
              ...scene,
              motion: m,
            },
            layout.width,
            layout.height,
            layout.duration,
          ).plan,
        );
      })
      .map((m) => ({
        motion: m,
        profile: visualProfile(scene, m),
        subjects,
        base: m?.recipeId === supplied[0]?.recipeId ? 4 : 0,
      }))
      .sort(
        (a, b) =>
          b.base - a.base ||
          stableSubjectHash(`${settings.seed}:${index}:${a.motion?.recipeId}`) -
            stableSubjectHash(
              `${settings.seed}:${index}:${b.motion?.recipeId}`,
            ),
      )
      .slice(0, SEQUENCE_SEARCH.maxCandidates);
  });
  const past: Choice[] = history.slice(-4).map((m) => ({
    motion: m,
    profile: m?.decision?.profile ?? visualProfile({ text: "" }, m),
    subjects: m?.decision?.subjectIds ?? [],
    base: 0,
  }));
  const result: Array<MotionDirection | undefined> = [];
  const score = (
    choice: Choice,
    previous: Choice[],
    scene: MotionPlanScene,
  ) => {
    let value = choice.base;
    if (!choice.motion) return value;
    const shared = previous
      .at(-1)
      ?.subjects.some((id) => choice.subjects.includes(id));
    if (isAdaptiveRecipe(choice.motion.recipeId)) value += 5;
    if (scene.text.length > 130 && choice.profile.silhouette === "reading")
      value += 4;
    if (scene.energy === "calm" && choice.profile.movement === "zoom")
      value -= 4;
    const last = previous.at(-1);
    if (last?.profile.silhouette === choice.profile.silhouette)
      value -= shared ? 1 : 7;
    if (last?.profile.movement === choice.profile.movement && !shared)
      value -= 2;
    if (
      previous
        .slice(-2)
        .filter((p) => p.motion?.recipeId === choice.motion?.recipeId)
        .length === 2
    )
      value -= shared ? 1 : 9;
    if (
      shared &&
      ["adaptive-comparison", "adaptive-process"].includes(
        choice.motion.recipeId,
      ) &&
      last?.motion?.recipeId.startsWith("adaptive-")
    )
      value += 6;
    return value;
  };
  for (let index = 0; index < scenes.length; index++) {
    let beams: Array<{ choices: Choice[]; score: number }> = [
      { choices: [], score: 0 },
    ];
    for (
      let step = index;
      step < Math.min(scenes.length, index + SEQUENCE_SEARCH.depth);
      step++
    ) {
      beams = beams
        .flatMap((beam) =>
          (eligible[step].length
            ? eligible[step]
            : [
                {
                  motion: undefined,
                  profile: fallbackProfile,
                  subjects: [],
                  base: 0,
                },
              ]
          ).map((choice) => ({
            choices: [...beam.choices, choice],
            score:
              beam.score +
              score(choice, [...past, ...beam.choices].slice(-4), scenes[step]),
          })),
        )
        .sort((a, b) => b.score - a.score)
        .slice(0, SEQUENCE_SEARCH.beamWidth);
    }
    const choice = beams[0].choices[0],
      scene = scenes[index];
    if (scene.locked) result.push(scene.current);
    else if (choice.motion) {
      const previous = past.at(-1),
        shared = previous?.subjects.some((id) => choice.subjects.includes(id));
      const reason = `Selected ${choice.motion.recipeId} for ${scene.role ?? "explanation"}: ${choice.profile.silhouette}, ${choice.profile.density} density, ${choice.profile.subjects} subjects. ${shared ? "Retain recurring subject identity; compatible cards can carry forward." : "Balance the previous and next two eligible compositions."}`;
      const alternatives = eligible[index]
        .filter(
          (c) => c.motion && c.motion.recipeId !== choice.motion?.recipeId,
        )
        .slice(0, 2)
        .map((c) => ({
          recipeId: c.motion!.recipeId as MotionRecipeId,
          reason: `Compatible ${c.profile.silhouette} alternative using the same supplied content.`,
        }));
      result.push({
        ...choice.motion,
        system: settings.system ?? "precision",
        sequenceVersion: 1,
        decision: {
          version: 1,
          sourceKey: sequenceSourceKey(scene),
          subjectIds: choice.subjects,
          reason,
          profile: choice.profile,
          alternatives,
        },
      });
    } else result.push(undefined);
    past.push(choice);
    if (past.length > 4) past.shift();
  }
  return result;
}
