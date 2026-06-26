"use client";

import * as React from "react";
import {
  AbsoluteFill,
  OffthreadVideo,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";

import type { BrandTokens } from "../tokens";
import type { PanEffect, SceneBackground } from "../types";

function imageTransform(effect: PanEffect, frame: number, duration: number): string {
  const t = interpolate(frame, [0, Math.max(1, duration)], [0, 1], {
    extrapolateRight: "clamp",
  });
  switch (effect) {
    case "pan-left":
      return `scale(1.14) translateX(${interpolate(t, [0, 1], [4, -4])}%)`;
    case "pan-right":
      return `scale(1.14) translateX(${interpolate(t, [0, 1], [-4, 4])}%)`;
    case "pan-up":
      return `scale(1.14) translateY(${interpolate(t, [0, 1], [4, -4])}%)`;
    case "pan-down":
      return `scale(1.14) translateY(${interpolate(t, [0, 1], [-4, 4])}%)`;
    case "ken-burns":
    default:
      return `scale(${1 + t * 0.08})`;
  }
}

/**
 * Full-bleed scene background (image or video) with a dark gradient scrim so
 * foreground text stays legible. Images get a Ken Burns / pan animation; videos
 * play muted by default so they never fight the voiceover.
 */
function SceneBackgroundLayer({
  background,
  durationInFrames,
}: {
  background: SceneBackground;
  durationInFrames: number;
}) {
  const frame = useCurrentFrame();
  // If a video background fails (unreachable URL, CORS, codec), fall back to the
  // animated brand background instead of crashing the whole player/render.
  // Track the URL that failed so the state resets automatically when the scene's
  // background changes — no setState-in-effect needed.
  const [failedUrl, setFailedUrl] = React.useState<string | null>(null);
  const videoFailed = failedUrl === background.url;

  return (
    <>
      {background.type === "video" && !videoFailed ? (
        <AbsoluteFill style={{ overflow: "hidden" }}>
          <OffthreadVideo
            src={background.url}
            muted={background.muted ?? true}
            onError={() => setFailedUrl(background.url)}
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
          />
        </AbsoluteFill>
      ) : background.type === "image" ? (
        <AbsoluteFill
          style={{
            backgroundImage: `url(${JSON.stringify(background.url)})`,
            backgroundSize: "cover",
            backgroundPosition: "center",
            transform: imageTransform(
              background.effect ?? "ken-burns",
              frame,
              durationInFrames,
            ),
            transformOrigin: "center center",
          }}
        />
      ) : null}
      <AbsoluteFill
        style={{
          background:
            "linear-gradient(to top, rgba(0,0,0,0.86) 0%, rgba(0,0,0,0.25) 55%, rgba(0,0,0,0.12) 100%)",
        }}
      />
    </>
  );
}

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

/**
 * Context that lets the editor toggle the progress bar without touching every
 * template. Provided once at the composition root; consumed only by ProgressBar.
 */
const StageOptionsContext = React.createContext<{ showProgressBar: boolean }>({
  showProgressBar: true,
});

export function StageOptionsProvider({
  showProgressBar = true,
  children,
}: {
  showProgressBar?: boolean;
  children: React.ReactNode;
}) {
  const value = React.useMemo(() => ({ showProgressBar }), [showProgressBar]);
  return (
    <StageOptionsContext.Provider value={value}>{children}</StageOptionsContext.Provider>
  );
}

/** Thin top progress bar reflecting how far through the scene we are. */
function ProgressBar({ tokens }: { tokens: BrandTokens }) {
  const { showProgressBar } = React.useContext(StageOptionsContext);
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const progress = interpolate(frame, [0, Math.max(1, durationInFrames - 1)], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  if (!showProgressBar) return null;
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
  background,
  durationInFrames,
}: {
  tokens: BrandTokens;
  children?: React.ReactNode;
  contentStyle?: React.CSSProperties;
  /** Full-bleed layer rendered above the lighting but below grain/vignette (e.g. a 3D canvas). */
  backdrop?: React.ReactNode;
  /** Per-scene image/video background — takes precedence over `backdrop` when set. */
  background?: SceneBackground;
  /** This scene's sequence length, used to time the background image animation. */
  durationInFrames?: number;
}) {
  const hasBackground = Boolean(background && background.url);
  const computedBackdrop = hasBackground ? (
    <SceneBackgroundLayer
      background={background!}
      durationInFrames={durationInFrames ?? 1}
    />
  ) : (
    backdrop
  );

  return (
    <AbsoluteFill style={{ fontFamily: tokens.fontFamily, overflow: "hidden" }}>
      <AnimatedBackground tokens={tokens} />
      {computedBackdrop ? <AbsoluteFill>{computedBackdrop}</AbsoluteFill> : null}
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
