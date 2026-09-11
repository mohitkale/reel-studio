"use client";

import * as React from "react";
import {
  Img,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";

import { AnimatedText } from "@/compositions/components/animated-text";
import { Stage } from "@/compositions/components/stage";
import type { TemplateProps } from "@/compositions/types";

function CodePanel({
  role,
  lines,
  accent,
  frame,
  fps,
  portrait,
}: {
  role: string;
  lines: string[];
  accent: string;
  frame: number;
  fps: number;
  portrait: boolean;
}) {
  return (
    <div
      style={{
        overflow: "hidden",
        border: "1px solid rgba(125,211,252,.24)",
        borderRadius: 18,
        background: "rgba(3,9,18,.9)",
        boxShadow: "0 30px 90px rgba(0,0,0,.38)",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          height: 42,
          padding: "0 16px",
          borderBottom: "1px solid rgba(125,211,252,.16)",
          color: "#7890a1",
          fontSize: 15,
        }}
      >
        <span style={{ color: accent }}>●</span>
        <span>
          {role === "terminal"
            ? "terminal"
            : role === "diff"
              ? "change.diff"
              : "production.ts"}
        </span>
      </div>
      <div
        style={{
          padding: portrait ? "24px 22px" : "22px 26px",
          fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
          fontSize: portrait ? 28 : 23,
          lineHeight: 1.55,
        }}
      >
        {lines.map((line, index) => {
          const lineIn = spring({
            frame: frame - 4 - index * 3,
            fps,
            config: { damping: 190, stiffness: 110 },
          });
          const isAdd = role === "diff" && line.startsWith("+");
          const isRemove = role === "diff" && line.startsWith("-");
          return (
            <div
              key={`${index}-${line}`}
              style={{
                padding: "3px 8px",
                color: isAdd ? "#86efac" : isRemove ? "#fda4af" : "#d8e8f2",
                background: isAdd
                  ? "rgba(34,197,94,.1)"
                  : isRemove
                    ? "rgba(244,63,94,.1)"
                    : "transparent",
                opacity: lineIn,
                transform: `translateX(${(1 - lineIn) * 20}px)`,
                whiteSpace: "pre-wrap",
                overflowWrap: "anywhere",
              }}
            >
              <span
                style={{
                  display: "inline-block",
                  width: 34,
                  color: "#496071",
                  userSelect: "none",
                }}
              >
                {String(index + 1).padStart(2, "0")}
              </span>
              {line}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** Remotion implementation of Developer Demo 1.0.0 scene roles. */
export const DeveloperDemoScene = React.memo(function DeveloperDemoScene({
  scene,
  tokens,
  durationInFrames,
}: TemplateProps) {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const portrait = height > width * 1.15;
  const enter = spring({
    frame,
    fps,
    config: { damping: 180, stiffness: 105 },
  });
  const exit = interpolate(
    frame,
    [Math.max(0, durationInFrames - 12), durationInFrames],
    [1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );
  const role = scene.role ?? "code";
  const lines = (scene.items ?? [])
    .map((line) => line.trimEnd())
    .filter(Boolean)
    .slice(0, 10);
  const technicalTokens = {
    ...tokens,
    foreground: "#eef8ff",
    muted: "#91a7b5",
  };

  return (
    <Stage
      tokens={technicalTokens}
      mood="tech"
      treatmentSeed={scene.order}
      durationInFrames={durationInFrames}
      contentStyle={{ alignItems: "stretch", justifyContent: "center" }}
    >
      <div
        data-production-preset="developer-demo"
        data-scene-role={role}
        style={{
          width: "100%",
          maxWidth: 1120,
          margin: "0 auto",
          opacity: exit,
        }}
      >
        <div
          style={{
            marginBottom: portrait ? 34 : 24,
            color: tokens.accent,
            fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
            fontSize: portrait ? 20 : 16,
            fontWeight: 750,
            letterSpacing: ".12em",
            opacity: enter,
          }}
        >
          &gt; {role}
        </div>
        {role === "browser" && scene.background?.url ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
            <div
              style={{
                overflow: "hidden",
                padding: 12,
                border: "1px solid rgba(255,255,255,.2)",
                borderRadius: 24,
                background: "rgba(255,255,255,.08)",
                transform: `perspective(1200px) rotateX(${(1 - enter) * 7}deg) translateY(${(1 - enter) * 38}px)`,
              }}
            >
              <div
                style={{
                  height: 38,
                  padding: "0 14px",
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  borderRadius: "14px 14px 0 0",
                  background: "#07101a",
                }}
              >
                <span style={{ color: "#fb7185" }}>●</span>
                <span style={{ color: "#fbbf24" }}>●</span>
                <span style={{ color: "#4ade80" }}>●</span>
              </div>
              <Img
                src={scene.background.url}
                style={{
                  width: "100%",
                  aspectRatio: "16 / 10",
                  display: "block",
                  objectFit: "cover",
                  borderRadius: "0 0 14px 14px",
                }}
              />
            </div>
            <AnimatedText
              text={scene.text}
              emphasis={scene.emphasis}
              tokens={technicalTokens}
              fontSize={portrait ? 50 : 42}
              fontWeight={780}
              startDelay={7}
              maxWidth={1000}
            />
          </div>
        ) : (role === "code" || role === "diff" || role === "terminal") &&
          lines.length ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 26 }}>
            <AnimatedText
              text={scene.text}
              emphasis={scene.emphasis}
              tokens={technicalTokens}
              fontSize={portrait ? 58 : 48}
              fontWeight={820}
              align="left"
              startDelay={1}
              maxWidth={1040}
            />
            <CodePanel
              role={role}
              lines={lines}
              accent={tokens.accent}
              frame={frame}
              fps={fps}
              portrait={portrait}
            />
          </div>
        ) : (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "flex-start",
              gap: 34,
            }}
          >
            <AnimatedText
              text={scene.text}
              emphasis={scene.emphasis}
              tokens={technicalTokens}
              fontSize={portrait ? 78 : 66}
              fontWeight={880}
              align="left"
              startDelay={1}
              maxWidth={1040}
            />
            {scene.visual ? (
              <div
                style={{
                  padding: "15px 24px",
                  borderRadius: 10,
                  color: "#07101a",
                  background: tokens.accent,
                  fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
                  fontSize: portrait ? 28 : 23,
                  fontWeight: 850,
                  opacity: enter,
                }}
              >
                {scene.visual}
              </div>
            ) : null}
          </div>
        )}
      </div>
    </Stage>
  );
});
