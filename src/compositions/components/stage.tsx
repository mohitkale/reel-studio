"use client";

import * as React from "react";
import {
  AbsoluteFill,
  OffthreadVideo,
  continueRender,
  delayRender,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";

import type { BrandTokens } from "../tokens";
import type { PanEffect, SceneBackground } from "../types";
import { DynamicBackground, pickBackgroundTreatment } from "./background-treatments";
import { useVisualStyle } from "./visual-style-context";

/**
 * CSS `backgroundImage` (used for the Ken Burns/pan effect) isn't tracked by
 * Remotion's asset-waiting machinery the way `<Img>` is, so a slow-loading
 * background could get captured mid-render as a blank frame. Preload it via
 * `delayRender`/`continueRender` so the renderer waits for the network fetch
 * (bounded by Remotion's render timeout) instead of racing it.
 */
function usePreloadedBackgroundImage(url: string | undefined): void {
  React.useEffect(() => {
    if (!url) return;
    let settled = false;
    const handle = delayRender(`Loading scene background image: ${url}`);
    const finish = () => {
      if (settled) return;
      settled = true;
      continueRender(handle);
    };
    const img = new window.Image();
    img.onload = finish;
    img.onerror = finish; // never block the render on a broken image URL
    img.src = url;
    return finish;
  }, [url]);
}

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
const SceneBackgroundLayer = React.memo(function SceneBackgroundLayer({
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
  usePreloadedBackgroundImage(background.type === "image" ? background.url : undefined);

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
          // Stronger mid/top scrim so white type stays readable on busy photos.
          background:
            "linear-gradient(to top, rgba(0,0,0,0.9) 0%, rgba(0,0,0,0.45) 48%, rgba(0,0,0,0.35) 100%)",
        }}
      />
    </>
  );
});

/**
 * Production-grade scene "lighting": one of several deterministic animated
 * background treatments (Aurora Glow, Floating Particles, Grid Pulse, Bokeh
 * Drift, Wave Mesh), chosen from the scene's `mood` (when the AI/user set
 * one) or a stable per-position fallback so backgroundless scenes never look
 * identical. See background-treatments.tsx for the treatments themselves.
 */
const AnimatedBackground = React.memo(function AnimatedBackground({
  tokens,
  mood,
  treatmentSeed = 0,
}: {
  tokens: BrandTokens;
  mood?: string;
  treatmentSeed?: number;
}) {
  const { quality } = useStageOptions();
  const treatment = React.useMemo(
    () => pickBackgroundTreatment(mood, treatmentSeed),
    [mood, treatmentSeed],
  );
  return (
    <DynamicBackground
      treatment={treatment}
      tokens={tokens}
      quality={quality}
      mood={mood}
      treatmentSeed={treatmentSeed}
    />
  );
});

/** Static film grain via SVG turbulence. Skipped in draft preview mode. */
const Grain = React.memo(function Grain({ opacity }: { opacity: number }) {
  const id = React.useId().replace(/:/g, "");
  if (opacity <= 0) return null;
  return (
    <svg
      style={{
        position: "absolute",
        inset: 0,
        width: "100%",
        height: "100%",
        opacity,
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
});

/**
 * Context that lets the editor toggle the progress bar and preview quality
 * without touching every template. Provided once at the composition root.
 * "draft" trims expensive effects (blur layers, grain, 3D particle count) for
 * smoother scrubbing on lower-end machines; renders always use "standard".
 */
const StageOptionsContext = React.createContext<{
  showProgressBar: boolean;
  quality: "standard" | "draft";
}>({
  showProgressBar: true,
  quality: "standard",
});

export function useStageOptions() {
  return React.useContext(StageOptionsContext);
}

export function StageOptionsProvider({
  showProgressBar = true,
  quality = "standard",
  children,
}: {
  showProgressBar?: boolean;
  quality?: "standard" | "draft";
  children: React.ReactNode;
}) {
  const value = React.useMemo(
    () => ({ showProgressBar, quality }),
    [showProgressBar, quality],
  );
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

const BrandBug = React.memo(function BrandBug({ tokens }: { tokens: BrandTokens }) {
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
});

/**
 * Cinematic wrapper shared by every template: animated lighting, grain,
 * vignette, top progress bar, and a brand bug. Content renders in the safe area.
 */
export const Stage = React.memo(function Stage({
  tokens,
  children,
  contentStyle,
  backdrop,
  background,
  durationInFrames,
  mood,
  treatmentSeed,
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
  /** Emotional/visual tone; picks the dynamic background treatment when there's no `background`. */
  mood?: string;
  /** Scene position, used to vary the treatment deterministically when `mood` is unset. */
  treatmentSeed?: number;
}) {
  const { quality } = useStageOptions();
  const { chrome } = useVisualStyle();
  const hasBackground = Boolean(background?.url);
  const computedBackdrop = hasBackground ? (
    <SceneBackgroundLayer
      background={background!}
      durationInFrames={durationInFrames ?? 1}
    />
  ) : (
    backdrop
  );
  // Animated lighting only when there's no full-bleed photo/video — otherwise
  // the stock image (or 3D canvas) carries the scene and the gradient reads as
  // a dull wash bleeding through the scrim.
  const showAnimatedLighting = !hasBackground && !backdrop;
  const vignette = Math.max(0, Math.min(1, chrome.vignetteStrength));

  return (
    <AbsoluteFill style={{ fontFamily: tokens.fontFamily, overflow: "hidden" }}>
      {showAnimatedLighting ? (
        <AnimatedBackground tokens={tokens} mood={mood} treatmentSeed={treatmentSeed} />
      ) : null}
      {computedBackdrop ? <AbsoluteFill>{computedBackdrop}</AbsoluteFill> : null}
      {quality === "draft" ? null : <Grain opacity={chrome.grainOpacity} />}
      {/* Vignette — strength follows Style */}
      <AbsoluteFill
        style={{
          background: `radial-gradient(120% 100% at 50% 45%, transparent 55%, rgba(0,0,0,${vignette}) 100%)`,
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
});
