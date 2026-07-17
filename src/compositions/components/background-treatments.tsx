"use client";

import * as React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";

import type { BrandTokens } from "../tokens";
import type { SceneMood } from "../types";

/**
 * A small library of lightweight (CSS/SVG driven, no WebGL) animated
 * background treatments. Each scene gets a treatment + a mood-tinted palette so
 * consecutive scenes never collapse into the same brand-blue/orange gradient.
 */
export const BACKGROUND_TREATMENTS = [
  "aurora",
  "particles",
  "grid-pulse",
  "bokeh",
  "wave-mesh",
] as const;
export type BackgroundTreatment = (typeof BACKGROUND_TREATMENTS)[number];

const ALL_MOODS: SceneMood[] = [
  "energetic",
  "calm",
  "dramatic",
  "playful",
  "inspiring",
  "tech",
  "nature",
];

/**
 * Mood tint targets — blended with brand colors (not full overrides) so
 * consecutive scenes vary without losing brand identity.
 */
const MOOD_TINTS: Record<
  SceneMood,
  Pick<BrandTokens, "background" | "backgroundAccent" | "accent" | "accentSecondary">
> = {
  dramatic: {
    background: "#080812",
    backgroundAccent: "#1a0a2e",
    accent: "#7c3aed",
    accentSecondary: "#c026d3",
  },
  energetic: {
    background: "#140808",
    backgroundAccent: "#3d1200",
    accent: "#ff5900",
    accentSecondary: "#fbbf24",
  },
  calm: {
    background: "#061018",
    backgroundAccent: "#0c2340",
    accent: "#38bdf8",
    accentSecondary: "#6366f1",
  },
  playful: {
    background: "#120818",
    backgroundAccent: "#2a1038",
    accent: "#f472b6",
    accentSecondary: "#a78bfa",
  },
  inspiring: {
    background: "#0a1020",
    backgroundAccent: "#1a2848",
    accent: "#f59e0b",
    accentSecondary: "#fcd34d",
  },
  tech: {
    background: "#040810",
    backgroundAccent: "#0a1628",
    accent: "#22d3ee",
    accentSecondary: "#818cf8",
  },
  nature: {
    background: "#061408",
    backgroundAccent: "#0f2818",
    accent: "#4ade80",
    accentSecondary: "#86efac",
  },
};

function clampByte(n: number): number {
  return Math.max(0, Math.min(255, Math.round(n)));
}

function hexToRgb(hex: string): [number, number, number] | null {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return null;
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** Mix brand hex toward mood hex. `t` = mood weight (0 = brand only). */
function mixHex(brand: string, mood: string, t: number): string {
  const a = hexToRgb(brand);
  const b = hexToRgb(mood);
  if (!a || !b) return brand;
  const u = Math.max(0, Math.min(1, t));
  const r = clampByte(a[0] * (1 - u) + b[0] * u);
  const g = clampByte(a[1] * (1 - u) + b[1] * u);
  const bl = clampByte(a[2] * (1 - u) + b[2] * u);
  return `#${((1 << 24) | (r << 16) | (g << 8) | bl).toString(16).slice(1)}`;
}

const MOOD_TREATMENT: Record<SceneMood, BackgroundTreatment> = {
  dramatic: "grid-pulse",
  inspiring: "wave-mesh",
  energetic: "particles",
  tech: "grid-pulse",
  playful: "bokeh",
  calm: "wave-mesh",
  nature: "bokeh",
};

/** Resolve mood for palette/treatment when the scene has no explicit mood stored. */
export function resolveSceneMood(mood: string | undefined, seed: number): SceneMood {
  if (mood && mood in MOOD_TINTS) return mood as SceneMood;
  return ALL_MOODS[((seed % ALL_MOODS.length) + ALL_MOODS.length) % ALL_MOODS.length];
}

export function pickBackgroundTreatment(
  mood: string | undefined,
  seed: number,
): BackgroundTreatment {
  if (mood && mood in MOOD_TREATMENT) {
    return MOOD_TREATMENT[mood as SceneMood];
  }
  const i =
    ((seed % BACKGROUND_TREATMENTS.length) + BACKGROUND_TREATMENTS.length) %
    BACKGROUND_TREATMENTS.length;
  return BACKGROUND_TREATMENTS[i];
}

/**
 * Soft mood tint — keep brand readable. Foreground/muted stay brand-true so
 * on-screen text never loses contrast against a neon mood wash.
 */
export function treatmentTokens(
  tokens: BrandTokens,
  mood: string | undefined,
  seed: number,
): BrandTokens {
  const tint = MOOD_TINTS[resolveSceneMood(mood, seed)];
  return {
    ...tokens,
    background: mixHex(tokens.background, tint.background, 0.22),
    backgroundAccent: mixHex(tokens.backgroundAccent, tint.backgroundAccent, 0.28),
    // Accents shift lightly so highlights stay on-brand and high-contrast.
    accent: mixHex(tokens.accent, tint.accent, 0.22),
    accentSecondary: mixHex(tokens.accentSecondary, tint.accentSecondary, 0.22),
  };
}

interface TreatmentProps {
  tokens: BrandTokens;
  draft: boolean;
}

const Aurora = React.memo(function Aurora({ tokens, draft }: TreatmentProps) {
  const frame = useCurrentFrame();
  const x1 = 30 + Math.sin(frame / 70) * 14;
  const y1 = 28 + Math.cos(frame / 90) * 12;
  const x2 = 72 + Math.cos(frame / 80) * 14;
  const y2 = 70 + Math.sin(frame / 60) * 12;
  const blur = draft ? 24 : 40;

  return (
    <AbsoluteFill
      style={{
        background: `linear-gradient(155deg, ${tokens.background} 0%, ${tokens.backgroundAccent} 140%)`,
      }}
    >
      <AbsoluteFill
        style={{
          background: `radial-gradient(45% 45% at ${x1}% ${y1}%, ${tokens.accent}44 0%, transparent 62%)`,
          filter: `blur(${blur}px)`,
          mixBlendMode: "screen",
        }}
      />
      <AbsoluteFill
        style={{
          background: `radial-gradient(40% 40% at ${x2}% ${y2}%, ${tokens.accentSecondary}33 0%, transparent 62%)`,
          filter: `blur(${blur + 8}px)`,
          mixBlendMode: "screen",
        }}
      />
    </AbsoluteFill>
  );
});

function seeded(i: number): number {
  const x = Math.sin(i * 12.9898) * 43758.5453;
  return x - Math.floor(x);
}

const Particles = React.memo(function Particles({ tokens, draft }: TreatmentProps) {
  const frame = useCurrentFrame();
  const count = draft ? 10 : 22;
  const colors = [tokens.accent, tokens.accentSecondary, tokens.foreground];

  return (
    <AbsoluteFill
      style={{
        background: `radial-gradient(120% 100% at 50% 100%, ${tokens.backgroundAccent} 0%, ${tokens.background} 70%)`,
        overflow: "hidden",
      }}
    >
      {Array.from({ length: count }, (_, i) => {
        const r1 = seeded(i);
        const r2 = seeded(i + 100);
        const r3 = seeded(i + 200);
        const baseX = r1 * 100;
        const speed = 0.18 + r2 * 0.3;
        const size = 8 + r3 * 20;
        const y = 110 - (((frame * speed) + r1 * 140) % 140);
        const drift = Math.sin(frame / (35 + r2 * 35) + i) * 5;
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: `${baseX + drift}%`,
              top: `${y}%`,
              width: size,
              height: size,
              borderRadius: "50%",
              background: colors[i % colors.length],
              opacity: 0.18 + r3 * 0.22,
              filter: draft ? undefined : "blur(1px)",
              boxShadow: draft
                ? undefined
                : `0 0 ${size}px ${colors[i % colors.length]}55`,
            }}
          />
        );
      })}
    </AbsoluteFill>
  );
});

const GridPulse = React.memo(function GridPulse({ tokens, draft }: TreatmentProps) {
  const frame = useCurrentFrame();
  const scanX = interpolate(frame % 220, [0, 220], [-20, 120]);
  const pulse = 0.5 + 0.5 * Math.sin(frame / 24);

  return (
    <AbsoluteFill
      style={{
        background: `linear-gradient(165deg, ${tokens.background} 0%, ${tokens.backgroundAccent} 140%)`,
        overflow: "hidden",
      }}
    >
      <AbsoluteFill
        style={{
          backgroundImage: `linear-gradient(${tokens.accent}28 1px, transparent 1px), linear-gradient(90deg, ${tokens.accent}28 1px, transparent 1px)`,
          backgroundSize: draft ? "48px 48px" : "56px 56px",
          opacity: 0.4,
        }}
      />
      <AbsoluteFill
        style={{
          background: `radial-gradient(40% 65% at ${scanX}% 42%, ${tokens.accentSecondary}40 0%, transparent 68%)`,
          filter: draft ? "blur(20px)" : "blur(32px)",
          opacity: 0.28 + pulse * 0.2,
          mixBlendMode: "screen",
        }}
      />
    </AbsoluteFill>
  );
});

const Bokeh = React.memo(function Bokeh({ tokens, draft }: TreatmentProps) {
  const frame = useCurrentFrame();
  const count = draft ? 4 : 7;
  const colors = [tokens.accent, tokens.accentSecondary, tokens.foreground];

  return (
    <AbsoluteFill
      style={{
        background: `linear-gradient(150deg, ${tokens.background} 0%, ${tokens.backgroundAccent} 130%)`,
        overflow: "hidden",
      }}
    >
      {Array.from({ length: count }, (_, i) => {
        const r1 = seeded(i + 300);
        const r2 = seeded(i + 400);
        const r3 = seeded(i + 500);
        const size = 160 + r3 * 260;
        const cx = 12 + r1 * 76 + Math.sin(frame / (80 + i * 10)) * 12;
        const cy = 12 + r2 * 76 + Math.cos(frame / (100 + i * 8)) * 12;
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: `${cx}%`,
              top: `${cy}%`,
              width: size,
              height: size,
              borderRadius: "50%",
              transform: "translate(-50%, -50%)",
              background: colors[i % colors.length],
              opacity: draft ? 0.1 : 0.16,
              filter: draft ? "blur(24px)" : "blur(42px)",
              mixBlendMode: "screen",
            }}
          />
        );
      })}
    </AbsoluteFill>
  );
});

const WaveMesh = React.memo(function WaveMesh({ tokens, draft }: TreatmentProps) {
  const frame = useCurrentFrame();
  const layers = draft ? 3 : 4;

  function wavePath(phase: number, amplitude: number, yBase: number): string {
    const points: string[] = [];
    for (let x = -10; x <= 110; x += 8) {
      const y = yBase + Math.sin(x / 20 + phase) * amplitude;
      points.push(`${x},${y}`);
    }
    return `M0,120 L${points.join(" L")} L110,120 Z`;
  }

  return (
    <AbsoluteFill
      style={{
        background: `linear-gradient(180deg, ${tokens.background} 0%, ${tokens.backgroundAccent} 100%)`,
        overflow: "hidden",
      }}
    >
      <svg
        viewBox="0 0 100 120"
        preserveAspectRatio="none"
        style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}
      >
        {Array.from({ length: layers }, (_, i) => {
          const phase = frame / (120 + i * 35) + i * 1.7;
          const amplitude = 7 + i * 4;
          const yBase = 62 + i * 12;
          const colors = [tokens.accent, tokens.accentSecondary, tokens.foreground];
          return (
            <path
              key={i}
              d={wavePath(phase, amplitude, yBase)}
              fill={colors[i % colors.length]}
              opacity={0.07 + i * 0.03}
            />
          );
        })}
      </svg>
    </AbsoluteFill>
  );
});

export const DynamicBackground = React.memo(function DynamicBackground({
  treatment,
  tokens,
  quality,
  mood,
  treatmentSeed,
}: {
  treatment: BackgroundTreatment;
  tokens: BrandTokens;
  quality: "standard" | "draft";
  mood?: string;
  treatmentSeed: number;
}) {
  const draft = quality === "draft";
  const palette = treatmentTokens(tokens, mood, treatmentSeed);
  switch (treatment) {
    case "particles":
      return <Particles tokens={palette} draft={draft} />;
    case "grid-pulse":
      return <GridPulse tokens={palette} draft={draft} />;
    case "bokeh":
      return <Bokeh tokens={palette} draft={draft} />;
    case "wave-mesh":
      return <WaveMesh tokens={palette} draft={draft} />;
    case "aurora":
    default:
      return <Aurora tokens={palette} draft={draft} />;
  }
});
