"use client";

import * as React from "react";
import {
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";

import type { TemplateProps } from "../types";
import { Stage } from "../components/stage";
import { AnimatedText } from "../components/animated-text";

function headlineSize(text: string): number {
  const len = text.length;
  if (len > 95) return 76;
  if (len > 65) return 92;
  if (len > 38) return 108;
  return 124;
}

/**
 * Kinetic typography: an animated kicker, a masked word-by-word headline reveal
 * with marker-highlighted emphasis, a slow push-in, and a blur-out exit.
 */
export const KineticTypography = React.memo(function KineticTypography({
  scene,
  tokens,
  durationInFrames,
}: TemplateProps) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const kicker = spring({ frame, fps, config: { damping: 200, stiffness: 90 } });
  const push = interpolate(frame, [0, durationInFrames], [0.96, 1.05]);
  const exit = interpolate(
    frame,
    [durationInFrames - 12, durationInFrames],
    [1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );
  const exitBlur = interpolate(
    frame,
    [durationInFrames - 12, durationInFrames],
    [0, 12],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );

  return (
    <Stage tokens={tokens} background={scene.background} mood={scene.mood} treatmentSeed={scene.order} durationInFrames={durationInFrames} contentStyle={{ alignItems: "center", justifyContent: "center" }}>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 48,
          opacity: exit,
          filter: exitBlur > 0.3 ? `blur(${exitBlur}px)` : "none",
          transform: `scale(${push})`,
        }}
      >
        {/* Animated kicker */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 18,
            opacity: kicker,
            transform: `translateY(${(1 - kicker) * 24}px)`,
          }}
        >
          <span
            style={{
              height: 4,
              width: 56 * kicker,
              borderRadius: 4,
              background: `linear-gradient(90deg, ${tokens.accent}, ${tokens.accentSecondary})`,
            }}
          />
          <span
            style={{
              color: tokens.muted,
              fontSize: 30,
              fontWeight: 700,
              letterSpacing: "0.34em",
              textTransform: "uppercase",
            }}
          >
            Reel Studio
          </span>
        </div>

        <AnimatedText
          text={scene.text}
          emphasis={scene.emphasis}
          tokens={tokens}
          fontSize={headlineSize(scene.text)}
          fontWeight={900}
          startDelay={6}
          maxWidth={860}
        />
      </div>
    </Stage>
  );
});
