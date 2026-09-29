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

export const motionRecipeIdSchema = z.enum(["type-impact", "type-editorial"]);
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
): MotionDirection | undefined {
  if (!direction) return undefined;
  const recipe = TYPE_MOTION_RECIPES.find(
    (item) => item.id === direction.recipeId,
  );
  return recipe && Array.from(text).length <= recipe.maxCharacters
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
