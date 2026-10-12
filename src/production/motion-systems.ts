import { z } from "zod";
import type { MotionRecipeId } from "./motion";

export const MOTION_SYSTEMS = [
  {
    id: "editorial",
    name: "Editorial",
    description:
      "Asymmetric spreads, restrained frames and generous reading space.",
  },
  {
    id: "poster",
    name: "Graphic",
    description:
      "Colour fields and bold typography, balanced with quieter spreads.",
  },
  {
    id: "precision",
    name: "Precision",
    description: "Framed messages, ordered tiles and exact data ledgers.",
  },
] as const;
export const motionSystemSchema = z.enum(
  MOTION_SYSTEMS.map((system) => system.id),
);
export type MotionSystem = z.infer<typeof motionSystemSchema>;

/** Pick a coherent vocabulary, not a different theme for each scene. Saved brand colours remain authoritative. */
export function defaultMotionSystem(
  themeId?: string,
  presetId?: string,
): MotionSystem {
  if (themeId === "signal" || presetId === "creator-punch") return "poster";
  if (
    themeId === "studio" ||
    themeId === "circuit" ||
    ["product-launch", "developer-demo", "data-story"].includes(presetId ?? "")
  )
    return "precision";
  return "editorial";
}
export const SYSTEM_TYPE_RECIPES: Record<
  MotionSystem,
  readonly MotionRecipeId[]
> = {
  editorial: ["type-spread", "type-editorial", "type-window"],
  poster: ["type-poster", "type-impact", "type-spread", "type-window"],
  precision: ["type-window", "type-spread", "type-editorial"],
};
