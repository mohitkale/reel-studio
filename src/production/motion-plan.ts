import { z } from "zod";
import {
  motionSystemSchema,
  SYSTEM_TYPE_RECIPES,
  type MotionSystem,
} from "./motion-systems";

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
import { analyzeBeat } from "./director";
import type { EnergyId } from "@/video/visual-style";
import type { ShotDirection } from "@/video/shot-direction";
import {
  resolveSemanticGraphic,
  semanticStorySource,
} from "./semantic-direction";

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
  system: motionSystemSchema.optional(),
});
export type MotionPlanSettings = z.infer<typeof motionPlanSettingsSchema>;

export interface MotionPlanScene {
  role?: ProductionSceneRole;
  energy?: EnergyId;
  text: string;
  spokenText?: string;
  direction?: ShotDirection;
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

function candidates(
  scene: MotionPlanScene,
  ambition: VisualAmbition,
  system?: MotionSystem,
): MotionDirection[] {
  if (system) {
    // The vocabulary may vary; supplied structure and media meaning may not.
    let ids: MotionRecipeId[] = [];
    if (!scene.hasVisualContent) {
      if (
        scene.chart &&
        ["chart", "metric", "comparison"].includes(scene.role ?? "")
      )
        ids =
          scene.chart.labels.length === 1
            ? ["data-spotlight"]
            : ["data-bars", "data-ledger"];
      else if (scene.items?.length && !scene.background?.url) {
        if (scene.role === "comparison")
          ids = ["comparison-split", "comparison-stack"];
        else if (scene.role === "diagram") {
          // A hub and a path assert different relationships. Preserve their meaning.
          ids =
            scene.current?.recipeId === "diagram-orbit"
              ? ["diagram-orbit"]
              : ["diagram-path", "list-cascade"];
        } else ids = ["list-cascade", "list-grid"];
      } else if (
        scene.background?.url &&
        ["hero", "feature", "screenshot-demo"].includes(scene.role ?? "")
      )
        ids =
          scene.role === "screenshot-demo"
            ? ["media-device", "media-mat"]
            : ["media-cinematic", "media-mat"];
      else if (
        !scene.chart &&
        !scene.items?.length &&
        !scene.background?.url &&
        scene.text.trim()
      ) {
        if (["cta", "logo"].includes(scene.role ?? ""))
          ids = ["brand-frame", "brand-lockup", "type-poster"];
        else if (
          scene.role === "quote" &&
          analyzeBeat(scene.text).kind !== "prose"
        )
          ids = ["quote-margin"];
        else if (
          scene.role !== "metric" &&
          scene.role !== "chart" &&
          scene.role !== "browser"
        ) {
          ids = [...SYSTEM_TYPE_RECIPES[system]];
          if (ambition === "clean" || scene.energy === "calm")
            ids.push("quiet-divider", "quiet-center");
          if (
            ambition === "showcase" ||
            ["hook", "payoff", "emphasis"].includes(scene.role ?? "")
          )
            ids.push("type-poster", "type-impact");
        }
      }
    }
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
  // Prose does not become a diagram merely because a preset assigned that role.
  // Give text-only explanatory beats a real type treatment, and reserve quiet
  // reading layouts for Clean or deliberate breathing space in the sequence.
  const prose =
    !scene.chart &&
    !scene.items?.length &&
    !scene.background?.url &&
    !scene.hasVisualContent &&
    ([
      "explanation",
      "summary",
      "diagram",
      "tip",
      "feature",
      "code",
      "diff",
      "terminal",
      "takeaway",
      "testimonial",
    ].includes(scene.role ?? "") ||
      (scene.role === "quote" && analyzeBeat(scene.text).kind === "prose"));
  if (prose) {
    const ids: MotionRecipeId[] =
      ambition === "clean"
        ? ["quiet-divider", "quiet-center", "type-editorial"]
        : ["type-editorial", "type-impact", "quiet-divider"];
    return ids
      .map(motionDirection)
      .filter((direction) => !motionFallbackReason(direction, scene.text));
  }
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
  const storySource = semanticStorySource(scenes);
  return scenes.map((scene) => {
    if (scene.locked) {
      recent.push(scene.current);
      return scene.current;
    }
    // Meaningful illustrations outrank decorative typography. Family changes
    // may not erase an admitted definition, comparison or process.
    if (resolveSemanticGraphic(scene, storySource)) {
      recent.push(undefined);
      return undefined;
    }
    const choices = candidates(
      scene,
      settings.ambition,
      settings.chapterMotifs &&
        scene.chapterIndex !== undefined &&
        !scene.chart &&
        !scene.items?.length &&
        !scene.background?.url
        ? undefined
        : settings.system,
    );
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
      if (choice.recipeId.startsWith("quiet-")) {
        // Expressive videos still need a reading hold, but not quiet slides on
        // every explanation. Clean deliberately keeps that quieter language.
        value += settings.ambition === "clean" ? 6 : -10;
      }
      value +=
        choice.recipeId === "type-impact"
          ? settings.ambition === "clean" && !anchor
            ? -100
            : wantImpact
              ? 8
              : -30
          : 0;
      // Calm content should not inherit a launch-style slam just because its
      // opening is a hook. Explicit Showcase still permits those bold anchors.
      if (
        scene.energy === "calm" &&
        settings.ambition !== "showcase" &&
        choice.recipeId === "type-impact"
      )
        value -= 60;
      if (settings.system) {
        // Opening beats should speak the selected family's language rather than
        // giving every topic the same legacy impact intro.
        if (
          choice.recipeId === "type-impact" &&
          settings.ambition !== "showcase"
        )
          value -= 12;
        const vocabulary = SYSTEM_TYPE_RECIPES[settings.system];
        const position = vocabulary.indexOf(choice.recipeId);
        if (position >= 0)
          value +=
            5 +
            ((offset + recent.length) % vocabulary.length === position ? 3 : 0);
        if (choice.recipeId === "type-poster") {
          value += settings.system === "poster" && wantImpact ? 8 : -8;
          if (
            (scene.energy === "calm" && settings.ambition !== "showcase") ||
            (settings.ambition === "clean" && !anchor)
          )
            value -= 100;
        }
        if (choice.recipeId === "data-ledger")
          value += settings.system === "precision" ? 2 : 0;
        if (choice.recipeId === "list-grid")
          value += settings.system === "precision" ? 3 : 0;
        if (choice.recipeId === "list-cascade")
          value += settings.system === "editorial" ? 3 : 0;
        if (choice.recipeId === "media-mat")
          value += (recent.length + offset) % 2 ? 3 : -2;
      }
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
