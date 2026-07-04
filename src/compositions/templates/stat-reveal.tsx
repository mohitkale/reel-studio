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

/** Parse the first number-like token from text (e.g. "73%" or "10x"). */
function extractStat(visual: string | undefined, text: string): string {
  if (visual) return visual;
  const match = text.match(/[\d,.]+\s*[%x+kmb+]*/i);
  return match?.[0] ?? "?";
}

/**
 * Stat reveal: a big animated number/stat slams in with a counter-up effect,
 * then the supporting caption reveals below it. Good for metrics and key numbers.
 */
export const StatReveal = React.memo(function StatReveal({
  scene,
  tokens,
  durationInFrames,
}: TemplateProps) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const stat = extractStat(scene.visual, scene.text);

  const statIn = spring({
    frame,
    fps,
    config: { damping: 120, stiffness: 200, mass: 0.6 },
  });
  const scale = interpolate(statIn, [0, 1], [0.4, 1]);
  const statY = (1 - statIn) * 80;

  const glowPulse = 0.6 + Math.sin(frame / 18) * 0.4;

  const exit = interpolate(
    frame,
    [durationInFrames - 12, durationInFrames],
    [1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );

  return (
    <Stage tokens={tokens} background={scene.background} mood={scene.mood} treatmentSeed={scene.order} durationInFrames={durationInFrames} contentStyle={{ alignItems: "center", justifyContent: "center" }}>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 72,
          opacity: exit,
        }}
      >
        {/* Big stat number */}
        <div style={{ position: "relative", textAlign: "center" }}>
          {/* Glow halo */}
          <div
            style={{
              position: "absolute",
              inset: "-20%",
              borderRadius: "50%",
              background: `radial-gradient(circle, ${tokens.accent}55 0%, transparent 65%)`,
              filter: "blur(60px)",
              opacity: glowPulse,
            }}
          />
          <div
            style={{
              position: "relative",
              fontSize: stat.length > 4 ? 220 : 280,
              fontWeight: 900,
              lineHeight: 0.88,
              letterSpacing: "-0.04em",
              transform: `translateY(${statY}px) scale(${scale})`,
              background: `linear-gradient(135deg, ${tokens.foreground} 20%, ${tokens.accent} 60%, ${tokens.accentSecondary} 100%)`,
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
            }}
          >
            {stat}
          </div>
        </div>

        {/* Supporting caption */}
        <AnimatedText
          text={scene.text}
          emphasis={scene.emphasis}
          tokens={tokens}
          fontSize={68}
          fontWeight={700}
          startDelay={14}
          maxWidth={860}
        />
      </div>
    </Stage>
  );
});
