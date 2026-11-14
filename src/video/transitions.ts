/**
 * Scene-to-scene transitions (roadmap V7). Deterministic: the same theme
 * personality and scene count always give the same list, and a showy transition
 * (push, wipe, zoom) is never followed by another showy one, so the cut stays
 * the default and the showy ones land as accents.
 */
import type { MotionPersonality } from "@/video/themes/types";

export type SceneTransition = "cut" | "push" | "wipe" | "zoom";
export const SHOWY_TRANSITIONS: readonly SceneTransition[] = [
  "push",
  "wipe",
  "zoom",
];

const PALETTE: Record<MotionPersonality, readonly SceneTransition[]> = {
  snappy: ["push", "cut", "wipe"],
  punchy: ["zoom", "cut", "push"],
  smooth: ["push", "cut", "wipe"],
  calm: ["cut", "push", "cut"],
  bouncy: ["zoom", "push", "cut"],
  hard: ["cut", "wipe", "cut"],
  slow: ["cut", "zoom", "cut"],
};

const isShowy = (t: SceneTransition) => SHOWY_TRANSITIONS.includes(t);

/** The transition INTO each scene; the first scene has none (it is a cut from nothing). */
export function pickTransitions(
  sceneCount: number,
  personality: MotionPersonality,
): SceneTransition[] {
  const palette = PALETTE[personality];
  const out: SceneTransition[] = [];
  for (let i = 0; i < sceneCount; i++) {
    if (i === 0) {
      out.push("cut");
      continue;
    }
    let pick = palette[(i - 1) % palette.length]!;
    // After a showy transition the next one is a cut, so two showy ones never
    // sit side by side and the same showy kind never repeats back to back.
    if (isShowy(pick) && isShowy(out[i - 1]!)) pick = "cut";
    out.push(pick);
  }
  return out;
}
