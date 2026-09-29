import { z } from "zod";

import type { ProductionSceneRole } from "@/production/roles";

export const MOTION_RECIPE_VERSION = "1.0.0" as const;
export const TYPE_MOTION_RECIPES = [
  {
    id: "type-impact",
    name: "Impact",
    description: "Bold type with a decisive graphic hit.",
    maxCharacters: 120,
  },
  {
    id: "type-editorial",
    name: "Editorial",
    description: "A measured typographic reveal with generous space.",
    maxCharacters: 260,
  },
] as const;
export const DATA_MOTION_RECIPES = [
  {
    id: "data-spotlight",
    name: "Spotlight",
    description: "One supplied value takes the stage with a drawn orbit.",
    maxCharacters: 120,
  },
  {
    id: "data-bars",
    name: "Comparison bars",
    description: "Supplied values reveal as a clear horizontal comparison.",
    maxCharacters: 110,
  },
] as const;
export const DIAGRAM_MOTION_RECIPES = [
  {
    id: "diagram-path",
    name: "Path",
    description: "Ordered ideas travel along a numbered route.",
    maxCharacters: 90,
  },
  {
    id: "diagram-orbit",
    name: "Orbit",
    description: "The first idea anchors its related ideas in a radial layout.",
    maxCharacters: 90,
  },
] as const;
export const MEDIA_MOTION_RECIPES = [
  {
    id: "media-device",
    name: "Product frame",
    description: "A supplied image appears in a precise product window.",
    maxCharacters: 100,
  },
  {
    id: "media-cinematic",
    name: "Cinematic cover",
    description: "A supplied image fills the scene behind a strong headline.",
    maxCharacters: 140,
  },
] as const;
export const MOTION_RECIPES = [
  ...TYPE_MOTION_RECIPES,
  ...DATA_MOTION_RECIPES,
  ...DIAGRAM_MOTION_RECIPES,
  ...MEDIA_MOTION_RECIPES,
] as const;

export const motionRecipeIdSchema = z.enum([
  "type-impact",
  "type-editorial",
  "data-spotlight",
  "data-bars",
  "diagram-path",
  "diagram-orbit",
  "media-device",
  "media-cinematic",
]);
export type MotionRecipeId = z.infer<typeof motionRecipeIdSchema>;

export const motionDirectionSchema = z.object({
  recipeId: motionRecipeIdSchema,
  version: z.literal(MOTION_RECIPE_VERSION),
});
export type MotionDirection = z.infer<typeof motionDirectionSchema>;

const TYPE_ROLES = new Set<ProductionSceneRole>([
  "hook",
  "headline",
  "emphasis",
  "payoff",
  "takeaway",
]);
const DATA_ROLES = new Set<ProductionSceneRole>([
  "metric",
  "chart",
  "comparison",
]);

export interface MotionChartInput {
  labels: string[];
  series: Array<{ label: string; values: number[]; unit?: string }>;
  sourceAttribution?: string;
}

export function isDataMotionRecipe(id: MotionRecipeId): boolean {
  return id === "data-spotlight" || id === "data-bars";
}

export function isDiagramMotionRecipe(id: MotionRecipeId): boolean {
  return id === "diagram-path" || id === "diagram-orbit";
}

export function isMediaMotionRecipe(id: MotionRecipeId): boolean {
  return id === "media-device" || id === "media-cinematic";
}

export interface MotionMediaInput {
  type: "image" | "video";
  url: string;
}

export function formatMotionValue(value: number, unit = ""): string {
  return `${new Intl.NumberFormat("en-US", { maximumFractionDigits: 4 }).format(value)}${unit}`;
}

export function motionBarScaleMax(
  series: MotionChartInput["series"][number],
): number {
  const observedMax = Math.max(...series.values);
  return series.unit?.trim() === "%" && observedMax <= 100 ? 100 : observedMax;
}

export function motionSpotlightFraction(
  series: MotionChartInput["series"][number],
): number | undefined {
  const value = series.values[0];
  return series.unit?.trim() === "%" && value >= 0 && value <= 100
    ? value / 100
    : undefined;
}

/** Return an actionable reason so a saved decision can fall back transparently. */
export function motionFallbackReason(
  direction: MotionDirection,
  text: string,
  chart?: MotionChartInput,
  hasOtherVisualContent = false,
  items?: string[],
  background?: MotionMediaInput,
): string | undefined {
  const recipe = MOTION_RECIPES.find((item) => item.id === direction.recipeId);
  if (!recipe || direction.version !== MOTION_RECIPE_VERSION)
    return "This motion treatment version is unavailable.";
  if (Array.from(text).length > recipe.maxCharacters)
    return `This treatment supports up to ${recipe.maxCharacters} characters of copy.`;
  if (hasOtherVisualContent)
    return "This scene already has a visual or list that this treatment would hide.";
  if (isMediaMotionRecipe(direction.recipeId)) {
    if (!background?.url || background.type !== "image")
      return "Add a supplied image for this media treatment.";
    if (!text.trim()) return "Add a short headline for this media treatment.";
    if (chart || items?.length)
      return "This media treatment cannot hide chart data or diagram ideas.";
    return undefined;
  }
  if (isDiagramMotionRecipe(direction.recipeId)) {
    if (chart) return "This scene has chart data; choose a data treatment.";
    if (
      !items ||
      items.length < (direction.recipeId === "diagram-orbit" ? 3 : 2) ||
      items.length > 5
    )
      return "Add two to five diagram ideas (at least three for Orbit).";
    if (items.some((item) => !item.trim() || Array.from(item).length > 24))
      return "Keep every diagram idea to 24 characters or fewer.";
    return undefined;
  }
  if (items?.length)
    return "Choose a diagram treatment to keep the supplied ideas visible.";
  if (!isDataMotionRecipe(direction.recipeId))
    return chart
      ? "Choose a data treatment to keep the supplied chart visible."
      : undefined;
  if (!chart || chart.series.length !== 1)
    return "Add one series of supplied chart values for this treatment.";
  const values = chart.series[0]?.values;
  const labels = chart.labels;
  if (
    !values ||
    labels.length !== values.length ||
    labels.length < (direction.recipeId === "data-bars" ? 2 : 1) ||
    labels.length > 6
  )
    return "Use one to six matching labels and values (at least two for bars).";
  if (direction.recipeId === "data-spotlight" && labels.length !== 1)
    return "Spotlight needs exactly one value; choose Comparison bars for multiple values.";
  if (
    labels.some((label) => !label.trim() || Array.from(label).length > 24) ||
    values.some((value) => !Number.isFinite(value) || value < 0)
  )
    return "Use short labels and nonnegative, finite values.";
  if (
    Array.from(chart.series[0].label).length > 30 ||
    Array.from(chart.sourceAttribution ?? "").length > 120
  )
    return "Shorten the series label or source attribution for this layout.";
  if (direction.recipeId === "data-bars" && !values.some((value) => value > 0))
    return "Bars need at least one value above zero.";
  if (values.some((value) => value > 0 && Number(value.toFixed(4)) === 0))
    return "Values this small need a more precise data layout.";
  if (
    values.some(
      (value) =>
        formatMotionValue(value, chart.series[0].unit).length >
        (direction.recipeId === "data-bars" ? 12 : 16),
    )
  )
    return "The formatted values are too wide for this treatment.";
  return undefined;
}

export function supportsTypeMotion(
  role: ProductionSceneRole | undefined,
): boolean {
  return role !== undefined && TYPE_ROLES.has(role);
}

export function motionDirection(recipeId: MotionRecipeId): MotionDirection {
  return { recipeId, version: MOTION_RECIPE_VERSION };
}

/** Keep a saved decision until the copy no longer fits its authored composition. */
export function resolveMotionDirection(
  direction: MotionDirection | undefined,
  text: string,
  chart?: MotionChartInput,
  hasOtherVisualContent = false,
  items?: string[],
  background?: MotionMediaInput,
): MotionDirection | undefined {
  return direction &&
    !motionFallbackReason(
      direction,
      text,
      chart,
      hasOtherVisualContent,
      items,
      background,
    )
    ? direction
    : undefined;
}

/** A deterministic, content-aware first choice; callers persist the result. */
export function chooseTypeMotion(input: {
  role: ProductionSceneRole | undefined;
  text: string;
  previous?: MotionDirection;
  hasVisualContent?: boolean;
}): MotionDirection | undefined {
  if (
    !supportsTypeMotion(input.role) ||
    !input.text.trim() ||
    input.hasVisualContent
  )
    return undefined;
  const length = Array.from(input.text).length;
  if (length > 260) return undefined;
  const preferImpact =
    length <= 120 &&
    (input.role === "hook" ||
      input.role === "emphasis" ||
      input.role === "payoff");
  let recipeId: MotionRecipeId = preferImpact
    ? "type-impact"
    : "type-editorial";
  if (input.previous?.recipeId === recipeId && length <= 120) {
    recipeId = recipeId === "type-impact" ? "type-editorial" : "type-impact";
  }
  return motionDirection(recipeId);
}

/** Select a data design only when all displayed numbers are supplied and fit. */
export function chooseSceneMotion(input: {
  role: ProductionSceneRole | undefined;
  text: string;
  chart?: MotionChartInput;
  items?: string[];
  background?: MotionMediaInput;
  previous?: MotionDirection;
  current?: MotionDirection;
  hasVisualContent?: boolean;
}): MotionDirection | undefined {
  if (
    input.background?.type === "image" &&
    input.background.url &&
    input.role &&
    (input.role === "screenshot-demo" ||
      input.role === "hero" ||
      input.role === "feature")
  ) {
    if (
      !input.hasVisualContent &&
      input.current &&
      isMediaMotionRecipe(input.current.recipeId) &&
      !motionFallbackReason(
        input.current,
        input.text,
        input.chart,
        false,
        input.items,
        input.background,
      )
    )
      return input.current;
    const choices: MotionRecipeId[] =
      input.role === "screenshot-demo" ||
      (input.role === "feature" &&
        input.previous?.recipeId === "media-cinematic")
        ? ["media-device", "media-cinematic"]
        : ["media-cinematic", "media-device"];
    return choices
      .map(motionDirection)
      .find(
        (direction) =>
          !motionFallbackReason(
            direction,
            input.text,
            input.chart,
            Boolean(input.hasVisualContent),
            input.items,
            input.background,
          ),
      );
  }
  if (input.hasVisualContent) return undefined;
  if (input.background?.url) return undefined;
  if (input.items?.length && input.role === "diagram") {
    if (
      input.current &&
      isDiagramMotionRecipe(input.current.recipeId) &&
      !motionFallbackReason(
        input.current,
        input.text,
        input.chart,
        false,
        input.items,
      )
    )
      return input.current;
    const choices: MotionRecipeId[] = ["diagram-path"];
    return choices
      .map(motionDirection)
      .find(
        (direction) =>
          !motionFallbackReason(
            direction,
            input.text,
            input.chart,
            false,
            input.items,
          ),
      );
  }
  if (input.items?.length) return undefined;
  if (input.chart && input.role && DATA_ROLES.has(input.role)) {
    const preferBars = input.role !== "metric";
    const choices: MotionRecipeId[] = preferBars
      ? ["data-bars", "data-spotlight"]
      : ["data-spotlight", "data-bars"];
    if (
      input.current &&
      isDataMotionRecipe(input.current.recipeId) &&
      !motionFallbackReason(input.current, input.text, input.chart)
    )
      return input.current;
    return choices
      .map(motionDirection)
      .find(
        (direction) =>
          !motionFallbackReason(direction, input.text, input.chart),
      );
  }
  if (input.chart) return undefined;
  return chooseTypeMotion(input);
}
