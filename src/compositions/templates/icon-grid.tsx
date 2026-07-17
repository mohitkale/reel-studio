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

/** Split scene text into list items at newline, bullet, or semicolon. */
function parseItems(text: string): string[] {
  const split = text
    .split(/\n|•|;/)
    .map((s) => s.replace(/^[-*–]\s*/, "").trim())
    .filter(Boolean);
  return split.length > 1 ? split : [text];
}

function wordCount(s: string): number {
  return s.trim().split(/\s+/).filter(Boolean).length;
}

/** Prefer short checklist rows; drop empty noise. */
function normalizeItems(raw: string[]): string[] {
  return raw
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 5);
}

const CheckItem = React.memo(function CheckItem({
  text,
  icon,
  delay,
  tokens,
  durationInFrames,
  fontSize,
}: {
  text: string;
  icon: string;
  delay: number;
  tokens: TemplateProps["tokens"];
  durationInFrames: number;
  fontSize: number;
}) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const enter = spring({
    frame: frame - delay,
    fps,
    config: { damping: 220, stiffness: 90, mass: 0.75 },
  });
  const x = (1 - enter) * -36;
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
        alignItems: "flex-start",
        gap: 28,
        opacity: enter * exit,
        transform: `translateX(${x}px)`,
      }}
    >
      <div
        style={{
          flexShrink: 0,
          width: 72,
          height: 72,
          borderRadius: 22,
          marginTop: 4,
          background: `linear-gradient(145deg, ${tokens.accent}, ${tokens.accentSecondary})`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 34,
          color: tokens.accentForeground,
          boxShadow: `0 6px 20px ${tokens.accent}33`,
        }}
      >
        {icon}
      </div>
      <span
        style={{
          fontSize,
          fontWeight: 700,
          color: tokens.foreground,
          lineHeight: 1.18,
          letterSpacing: "-0.02em",
          textShadow: "0 2px 16px rgba(0,0,0,0.45)",
        }}
      >
        {text}
      </span>
    </div>
  );
});

/**
 * Checklist for 2–5 short tips. If the scene only has one long line, we fall
 * back to a clean kinetic statement so it never looks like a broken list.
 */
export const IconGrid = React.memo(function IconGrid({
  scene,
  tokens,
  durationInFrames,
}: TemplateProps) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const fromItems = scene.items && scene.items.length ? scene.items : null;
  const items = normalizeItems(fromItems ?? parseItems(scene.text));
  const icon = scene.visual || "✓";

  // One long beat ≠ a checklist — render as a personal statement instead.
  const isChecklist =
    items.length >= 2 && items.every((item) => wordCount(item) <= 12);

  const headerIn = spring({
    frame,
    fps,
    config: { damping: 220, stiffness: 90 },
  });

  if (!isChecklist) {
    const line = items[0] ?? scene.text;
    return (
      <Stage
        tokens={tokens}
        background={scene.background}
        mood={scene.mood}
        treatmentSeed={scene.order}
        durationInFrames={durationInFrames}
        contentStyle={{ justifyContent: "center", alignItems: "center" }}
      >
        <AnimatedText
          text={line}
          emphasis={scene.emphasis}
          tokens={tokens}
          fontSize={wordCount(line) > 14 ? 68 : 78}
          align="center"
        />
      </Stage>
    );
  }

  // Short header from scene.text when it isn't just a dump of the list.
  const header =
    fromItems && scene.text.trim() && wordCount(scene.text) <= 8
      ? scene.text.trim()
      : null;

  const longest = Math.max(...items.map(wordCount));
  const fontSize = longest > 8 ? 52 : longest > 5 ? 58 : 64;

  return (
    <Stage
      tokens={tokens}
      background={scene.background}
      mood={scene.mood}
      treatmentSeed={scene.order}
      durationInFrames={durationInFrames}
      contentStyle={{ justifyContent: "center" }}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 40, width: "100%" }}>
        {header ? (
          <div
            style={{
              opacity: headerIn,
              transform: `translateY(${(1 - headerIn) * -16}px)`,
              fontSize: 36,
              fontWeight: 700,
              letterSpacing: "-0.01em",
              color: tokens.muted,
              display: "flex",
              alignItems: "center",
              gap: 14,
            }}
          >
            <span
              style={{
                display: "inline-block",
                width: 28,
                height: 3,
                borderRadius: 3,
                background: tokens.accent,
              }}
            />
            {header}
          </div>
        ) : null}

        <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
          {items.map((item, i) => (
            <CheckItem
              key={i}
              text={item}
              icon={icon}
              delay={i * 9 + 5}
              tokens={tokens}
              durationInFrames={durationInFrames}
              fontSize={fontSize}
            />
          ))}
        </div>
      </div>
    </Stage>
  );
});
