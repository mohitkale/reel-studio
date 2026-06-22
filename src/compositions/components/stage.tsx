"use client";

import * as React from "react";
import {
  AbsoluteFill,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";

import type { BrandTokens } from "../tokens";

/** Drifting, blurred color blobs over a base gradient - the "lighting" of the scene. */
function AnimatedBackground({ tokens }: { tokens: BrandTokens }) {
  const frame = useCurrentFrame();
  const x1 = 30 + Math.sin(frame / 70) * 12;
  const y1 = 28 + Math.cos(frame / 90) * 10;
  const x2 = 72 + Math.cos(frame / 80) * 12;
  const y2 = 70 + Math.sin(frame / 60) * 10;

  return (
    <AbsoluteFill
      style={{
        background: `linear-gradient(155deg, ${tokens.background} 0%, ${tokens.backgroundAccent} 140%)`,
      }}
    >
      <AbsoluteFill
        style={{
          background: `radial-gradient(45% 45% at ${x1}% ${y1}%, ${tokens.accent}66 0%, transparent 60%)`,
          filter: "blur(40px)",
          mixBlendMode: "screen",
        }}
      />
      <AbsoluteFill
        style={{
          background: `radial-gradient(40% 40% at ${x2}% ${y2}%, ${tokens.accentSecondary}55 0%, transparent 60%)`,
          filter: "blur(50px)",
          mixBlendMode: "screen",
        }}
      />
    </AbsoluteFill>
  );
}

/** Static film grain via SVG turbulence. */
function Grain() {
  const id = React.useId().replace(/:/g, "");
  return (
    <svg
      style={{
        position: "absolute",
        inset: 0,
        width: "100%",
        height: "100%",
        opacity: 0.09,
        mixBlendMode: "overlay",
        pointerEvents: "none",
      }}
    >
      <filter id={`grain-${id}`}>
        <feTurbulence
          type="fractalNoise"
          baseFrequency="0.9"
          numOctaves={2}
          stitchTiles="stitch"
        />
      </filter>
      <rect width="100%" height="100%" filter={`url(#grain-${id})`} />
    </svg>
  );
}

/** Thin top progress bar reflecting how far through the scene we are. */
function ProgressBar({ tokens }: { tokens: BrandTokens }) {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const progress = interpolate(frame, [0, Math.max(1, durationInFrames - 1)], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  return (
    <div
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        height: 8,
        background: "rgba(255,255,255,0.12)",
      }}
    >
      <div
        style={{
          height: "100%",
          width: `${progress * 100}%`,
          background: `linear-gradient(90deg, ${tokens.accent}, ${tokens.accentSecondary})`,
          boxShadow: `0 0 24px ${tokens.accent}`,
        }}
      />
    </div>
  );
}

function BrandBug({ tokens }: { tokens: BrandTokens }) {
  return (
    <div
      style={{
        position: "absolute",
        bottom: 64,
        left: 0,
        right: 0,
        display: "flex",
        justifyContent: "center",
        gap: 14,
        alignItems: "center",
        color: tokens.muted,
        fontSize: 30,
        fontWeight: 600,
        letterSpacing: "0.02em",
      }}
    >
      <span
        style={{
          width: 30,
          height: 30,
          borderRadius: 9,
          background: `linear-gradient(135deg, ${tokens.accent}, ${tokens.accentSecondary})`,
        }}
      />
      {tokens.handle}
    </div>
  );
}

/**
 * Cinematic wrapper shared by every template: animated lighting, grain,
 * vignette, top progress bar, and a brand bug. Content renders in the safe area.
 */
export function Stage({
  tokens,
  children,
  contentStyle,
  backdrop,
}: {
  tokens: BrandTokens;
  children: React.ReactNode;
  contentStyle?: React.CSSProperties;
  /** Full-bleed layer rendered above the lighting but below grain/vignette (e.g. a 3D canvas). */
  backdrop?: React.ReactNode;
}) {
  return (
    <AbsoluteFill style={{ fontFamily: tokens.fontFamily, overflow: "hidden" }}>
      <AnimatedBackground tokens={tokens} />
      {backdrop ? <AbsoluteFill>{backdrop}</AbsoluteFill> : null}
      <Grain />
      {/* Vignette */}
      <AbsoluteFill
        style={{
          background:
            "radial-gradient(120% 100% at 50% 45%, transparent 55%, rgba(0,0,0,0.55) 100%)",
        }}
      />
      <AbsoluteFill
        style={{
          padding: "150px 96px 220px",
          ...contentStyle,
        }}
      >
        {children}
      </AbsoluteFill>
      <ProgressBar tokens={tokens} />
      <BrandBug tokens={tokens} />
    </AbsoluteFill>
  );
}
