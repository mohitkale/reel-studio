"use client";

import * as React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from "remotion";

import type { BrandTokens } from "../tokens";
import type { TransitionRecipe } from "../visual-style";
import { useVisualStyle } from "./visual-style-context";

/**
 * Applies the Style's enter/exit recipe to a scene so consecutive beats don't
 * hard-cut. Kept lightweight (opacity / translate / blur / accent flash).
 */
export const SceneTransition = React.memo(function SceneTransition({
  tokens,
  children,
}: {
  tokens: BrandTokens;
  children: React.ReactNode;
}) {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const { transition, transitionFrames } = useVisualStyle();
  const tf = Math.max(3, Math.min(transitionFrames, Math.floor(durationInFrames / 3)));

  const enter = interpolate(frame, [0, tf], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const exit = interpolate(
    frame,
    [Math.max(tf, durationInFrames - tf), durationInFrames],
    [0, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );

  const style = recipeStyle(transition, enter, exit);

  return (
    <AbsoluteFill style={style.layer}>
      {style.flash ? (
        <AbsoluteFill
          style={{
            background: tokens.accent,
            opacity: style.flash,
            pointerEvents: "none",
            zIndex: 20,
          }}
        />
      ) : null}
      <AbsoluteFill style={style.content}>{children}</AbsoluteFill>
    </AbsoluteFill>
  );
});

function recipeStyle(
  transition: TransitionRecipe,
  enter: number,
  exit: number,
): {
  layer: React.CSSProperties;
  content: React.CSSProperties;
  flash?: number;
} {
  const visibility = enter * (1 - exit);
  switch (transition) {
    case "blur-slide":
      return {
        layer: {},
        content: {
          opacity: visibility,
          transform: `translateY(${(1 - enter) * 36 + exit * -28}px)`,
          filter: `blur(${(1 - enter) * 8 + exit * 6}px)`,
        },
      };
    case "accent-flash":
      return {
        layer: {},
        content: {
          opacity: Math.max(visibility, enter > 0.15 ? visibility : enter),
          transform: `scale(${0.97 + enter * 0.03 - exit * 0.015})`,
        },
        // Soft brand wash — never blast the frame with solid accent.
        flash: enter < 1 ? (1 - enter) * 0.14 : exit > 0 ? exit * 0.08 : 0,
      };
    case "crossfade":
    default:
      return {
        layer: {},
        content: { opacity: visibility },
      };
  }
}
