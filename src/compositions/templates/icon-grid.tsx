"use client";

import {
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";

import type { TemplateProps } from "../types";
import { Stage } from "../components/stage";

/** Split scene text into list items at newline, bullet, or semicolon. */
function parseItems(text: string): string[] {
  const split = text
    .split(/\n|•|;/)
    .map((s) => s.replace(/^[-*–]\s*/, "").trim())
    .filter(Boolean);
  return split.length > 1 ? split : [text];
}

function CheckItem({
  text,
  icon,
  delay,
  tokens,
  durationInFrames,
}: {
  text: string;
  icon: string;
  delay: number;
  tokens: TemplateProps["tokens"];
  durationInFrames: number;
}) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const enter = spring({
    frame: frame - delay,
    fps,
    config: { damping: 200, stiffness: 80, mass: 0.8 },
  });
  const x = (1 - enter) * -60;
  const exit = interpolate(
    frame,
    [durationInFrames - 12, durationInFrames],
    [1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 36,
        opacity: enter * exit,
        transform: `translateX(${x}px)`,
      }}
    >
      {/* Icon badge — solid accent gradient so it pops against the dark background */}
      <div
        style={{
          flexShrink: 0,
          width: 96,
          height: 96,
          borderRadius: 28,
          background: `linear-gradient(135deg, ${tokens.accent}, ${tokens.accentSecondary})`,
          border: `2px solid ${tokens.accent}`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 48,
          boxShadow: `0 4px 16px ${tokens.accent}66`,
        }}
      >
        {icon}
      </div>
      <span
        style={{
          fontSize: 68,
          fontWeight: 700,
          color: tokens.foreground,
          lineHeight: 1.1,
          letterSpacing: "-0.015em",
        }}
      >
        {text}
      </span>
    </div>
  );
}

/**
 * Icon grid / checklist: each line of the scene text becomes a row with an
 * icon badge and text. Good for tips, steps, and feature lists.
 */
export function IconGrid({ scene, tokens, durationInFrames }: TemplateProps) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Prefer an explicit item list; fall back to splitting the scene text.
  const items =
    scene.items && scene.items.length ? scene.items : parseItems(scene.text);
  const icon = scene.visual || "✓";

  const headerIn = spring({
    frame,
    fps,
    config: { damping: 200, stiffness: 90 },
  });

  return (
    <Stage tokens={tokens} background={scene.background} durationInFrames={durationInFrames} contentStyle={{ justifyContent: "center" }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 48 }}>
        {/* Header label */}
        <div
          style={{
            opacity: headerIn,
            transform: `translateY(${(1 - headerIn) * -20}px)`,
            fontSize: 32,
            fontWeight: 700,
            letterSpacing: "0.3em",
            textTransform: "uppercase",
            color: tokens.muted,
            display: "flex",
            alignItems: "center",
            gap: 16,
          }}
        >
          <span
            style={{
              display: "inline-block",
              width: 40,
              height: 3,
              borderRadius: 3,
              background: `linear-gradient(90deg, ${tokens.accent}, ${tokens.accentSecondary})`,
            }}
          />
          Quick checklist
        </div>

        {/* Items */}
        <div style={{ display: "flex", flexDirection: "column", gap: 32 }}>
          {items.map((item, i) => (
            <CheckItem
              key={i}
              text={item}
              icon={icon}
              delay={i * 10 + 6}
              tokens={tokens}
              durationInFrames={durationInFrames}
            />
          ))}
        </div>
      </div>
    </Stage>
  );
}
