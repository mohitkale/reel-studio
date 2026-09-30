import { z } from "zod";

import {
  chooseSceneMotion,
  isStoryMotionRecipe,
  motionDirection,
  motionFallbackReason,
  supportsTypeMotion,
  type MotionChartInput,
  type MotionDirection,
  type MotionMediaInput,
  type MotionRecipeId,
} from "@/production/motion";
import type { ProductionSceneRole } from "@/production/roles";

export const VISUAL_AMBITIONS = ["clean", "expressive", "showcase"] as const;
export const visualAmbitionSchema = z.enum(VISUAL_AMBITIONS);
export type VisualAmbition = z.infer<typeof visualAmbitionSchema>;
export const VISUAL_AMBITION_LABELS: Record<VisualAmbition, string> = {
  clean: "Clean",
  expressive: "Expressive",
  showcase: "Showcase",
};
export const VISUAL_AMBITION_DESCRIPTIONS: Record<VisualAmbition, string> = {
  clean: "Measured layouts, with bold type reserved for key moments.",
  expressive: "A balance of bold reveals and quieter reading space.",
  showcase: "More bold type moments, with space between consecutive hits.",
};
export const motionPlanSettingsSchema = z.object({
  version: z.literal("1.0.0"),
  seed: z.string().min(1).max(160),
  ambition: visualAmbitionSchema,
  chapterMotifs: z.boolean().optional(),
});
export type MotionPlanSettings = z.infer<typeof motionPlanSettingsSchema>;

export interface MotionPlanScene {
  role?: ProductionSceneRole;
  text: string;
  chart?: MotionChartInput;
  items?: string[];
  background?: MotionMediaInput;
  hasVisualContent?: boolean;
  current?: MotionDirection;
  /** A scene lock protects both a chosen treatment and an intentional preset look. */
  locked?: boolean;
  /** Resolved from the saved outline, never inferred from copy. */
  chapterIndex?: number;
  chapterStart?: boolean;
}

/** Stable variation at planning time only; renderers consume frozen decisions. */
function seedOffset(seed: string): number {
  let hash = 2166136261;
  for (const character of seed) {
    hash = Math.imul(hash ^ character.codePointAt(0)!, 16777619);
  }
  return hash >>> 0;
}

function candidates(scene: MotionPlanScene): MotionDirection[] {
  const first = chooseSceneMotion({ ...scene, role: scene.role });
  if (!first) return [];
  let ids: MotionRecipeId[] = [first.recipeId];
  if (isStoryMotionRecipe(first.recipeId)) {
    const family = first.recipeId.split("-")[0];
    ids =
      family === "comparison"
        ? ["comparison-split", "comparison-stack"]
        : family === "quiet"
          ? ["quiet-divider", "quiet-center"]
          : ["brand-lockup", "brand-frame"];
  } else if (scene.role === "screenshot-demo") {
    ids = ["media-device"];
  } else if (scene.role === "hero") {
    ids = ["media-cinematic"];
  } else if (
    supportsTypeMotion(scene.role) &&
    first.recipeId.startsWith("type-")
  ) {
    ids = ["type-impact", "type-editorial"];
  } else if (scene.role === "feature" && scene.background?.url) {
    ids = ["media-device", "media-cinematic"];
  }
  // Ordered ideas and screenshot/hero roles have meaning. Variety never changes
  // a process into a hub or crops a screenshot into a cover automatically.
  return ids
    .map(motionDirection)
    .filter(
      (direction) =>
        !motionFallbackReason(
          direction,
          scene.text,
          scene.chart,
          Boolean(scene.hasVisualContent),
          scene.items,
          scene.background,
        ),
    );
}

/** Plan a bounded sequence using actual scene history, including preset beats.
 * Existing history is supplied on append, so extending a video doesn't restart
 * its rhythm or reinterpret earlier scene choices.
 */
export function planMotionSequence(
  scenes: readonly MotionPlanScene[],
  settings: MotionPlanSettings,
  history: readonly (MotionDirection | undefined)[] = [],
): Array<MotionDirection | undefined> {
  const recent = [...history];
  const offset = seedOffset(settings.seed);
  return scenes.map((scene) => {
    if (scene.locked) {
      recent.push(scene.current);
      return scene.current;
    }
    const choices = candidates(scene);
    const anchor =
      scene.role === "hook" ||
      scene.role === "payoff" ||
      Boolean(settings.chapterMotifs && scene.chapterStart);
    const interval = settings.ambition === "showcase" ? 2 : 3;
    const wantImpact =
      anchor ||
      (settings.ambition !== "clean" &&
        (recent.length + offset) % interval === 0);
    const score = (choice: MotionDirection): number => {
      let value = isStoryMotionRecipe(choice.recipeId)
        ? (recent.length + offset) % 2 ===
          (choice.recipeId.endsWith("split") ||
          choice.recipeId.endsWith("divider") ||
          choice.recipeId.endsWith("lockup")
            ? 0
            : 1)
          ? 1
          : 0
        : 0;
      value +=
        choice.recipeId === "type-impact"
          ? settings.ambition === "clean" && !anchor
            ? -100
            : wantImpact
              ? 8
              : -30
          : 0;
      for (const [distance, previous] of recent.slice(-4).reverse().entries()) {
        if (previous?.recipeId === choice.recipeId) {
          value -= [20, 4, 2, 1][distance];
        }
      }
      // Give story anchors priority over repetition further back in the video.
      if (anchor && choice.recipeId === "type-impact") value += 8;
      if (choice.recipeId === "media-cinematic") {
        value += (recent.length + offset) % 2 === 0 ? 1 : -1;
      }
      return value;
    };
    let selected = choices.sort((a, b) => score(b) - score(a))[0];
    if (
      selected &&
      settings.chapterMotifs &&
      scene.chapterIndex !== undefined &&
      Number.isInteger(scene.chapterIndex) &&
      scene.chapterIndex >= 0 &&
      (selected.recipeId === "type-impact" ||
        selected.recipeId === "type-editorial")
    ) {
      selected = {
        ...selected,
        typeEntrance: (offset + scene.chapterIndex) % 2 ? "rise" : "sweep",
      };
    }
    recent.push(selected);
    return selected;
  });
}
