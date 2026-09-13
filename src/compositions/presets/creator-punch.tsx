"use client";

import * as React from "react";
import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";

import { AnimatedText } from "@/compositions/components/animated-text";
import { Stage } from "@/compositions/components/stage";
import type { TemplateProps } from "@/compositions/types";

function CreatorBackdrop({
  accent,
  secondary,
}: {
  accent: string;
  secondary: string;
}) {
  return (
    <AbsoluteFill
      style={{
        background: `radial-gradient(70% 55% at 15% 10%, ${accent}66, transparent 70%), radial-gradient(70% 55% at 90% 90%, ${secondary}52, transparent 72%), #0b0712`,
      }}
    >
      <AbsoluteFill
        style={{
          opacity: 0.14,
          backgroundImage:
            "linear-gradient(115deg, transparent 45%, rgba(255,255,255,.22) 46%, transparent 47%)",
          backgroundSize: "42px 42px",
        }}
      />
    </AbsoluteFill>
  );
}

/** Remotion implementation of Creator Punch 1.0.0 scene roles. */
export const CreatorPunchScene = React.memo(function CreatorPunchScene({
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
    config: { damping: 120, stiffness: 180, mass: 0.65 },
  });
  const pulse = 1 + Math.sin((frame / fps) * Math.PI * 3) * 0.018;
  const exit = interpolate(
    frame,
    [Math.max(0, durationInFrames - 8), durationInFrames],
    [1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );
  const role = scene.role ?? "tip";
  const items = (scene.items ?? [])
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 4);
  const displayTokens = { ...tokens, foreground: "#fffaf7", muted: "#c9bdd6" };
  const isHero =
    role === "hook" ||
    role === "emphasis" ||
    role === "payoff" ||
    role === "cta";

  return (
    <Stage
      tokens={displayTokens}
      backdrop={
        <CreatorBackdrop
          accent={tokens.accent}
          secondary={tokens.accentSecondary}
        />
      }
      durationInFrames={durationInFrames}
      contentStyle={{ alignItems: "center", justifyContent: "center" }}
    >
      <div
        data-production-preset="creator-punch"
        data-scene-role={role}
        style={{
          width: "100%",
          maxWidth: 1100,
          textAlign: "center",
          opacity: exit,
        }}
      >
        <div
          style={{
            display: "inline-flex",
            padding: "9px 16px",
            marginBottom: portrait ? 38 : 24,
            borderRadius: 999,
            color: "#0b0712",
            background: tokens.accent,
            fontSize: portrait ? 20 : 16,
            fontWeight: 900,
            letterSpacing: ".14em",
            textTransform: "uppercase",
            opacity: enter,
            transform: `rotate(${(1 - enter) * -8}deg) scale(${0.8 + enter * 0.2})`,
          }}
        >
          {role}
        </div>

        {role === "tip" && items.length ? (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: portrait ? 28 : 20,
            }}
          >
            <AnimatedText
              text={scene.text}
              emphasis={scene.emphasis}
              tokens={displayTokens}
              fontSize={portrait ? 70 : 58}
              fontWeight={900}
              startDelay={1}
              maxWidth={1040}
            />
            <div
              style={{
                display: "grid",
                gridTemplateColumns: portrait ? "1fr" : "repeat(2, 1fr)",
                gap: 14,
                textAlign: "left",
              }}
            >
              {items.map((item, index) => {
                const itemIn = spring({
                  frame: frame - 5 - index * 4,
                  fps,
                  config: { damping: 130, stiffness: 170 },
                });
                return (
                  <div
                    key={item}
                    style={{
                      display: "grid",
                      gridTemplateColumns: "52px 1fr",
                      alignItems: "center",
                      gap: 16,
                      padding: portrait ? "20px 22px" : "18px 20px",
                      border: "2px solid rgba(255,255,255,.18)",
                      borderRadius: 18,
                      background: "rgba(17,10,29,.8)",
                      color: "#fffaf7",
                      fontSize: portrait ? 34 : 28,
                      fontWeight: 800,
                      opacity: itemIn,
                      transform: `translateX(${(1 - itemIn) * (index % 2 ? 32 : -32)}px)`,
                    }}
                  >
                    <span style={{ color: tokens.accent, fontWeight: 950 }}>
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    {item}
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: portrait ? 34 : 24,
              transform: isHero ? `scale(${pulse})` : undefined,
            }}
          >
            {scene.visual ? (
              <div
                style={{
                  fontSize: portrait ? 112 : 86,
                  lineHeight: 1,
                  opacity: enter,
                  transform: `translateY(${(1 - enter) * -38}px) rotate(${(1 - enter) * 12}deg)`,
                }}
              >
                {scene.visual}
              </div>
            ) : null}
            <AnimatedText
              text={scene.text}
              emphasis={scene.emphasis}
              tokens={displayTokens}
              fontSize={
                portrait
                  ? role === "hook"
                    ? 96
                    : 84
                  : role === "hook"
                    ? 82
                    : 70
              }
              fontWeight={950}
              startDelay={1}
              maxWidth={1050}
            />
            {role === "cta" && scene.items?.[0] ? (
              <div
                style={{
                  padding: "18px 34px",
                  borderRadius: 16,
                  color: "#0b0712",
                  background: tokens.accent,
                  boxShadow: `8px 8px 0 ${tokens.accentSecondary}`,
                  fontSize: portrait ? 34 : 28,
                  fontWeight: 950,
                  opacity: enter,
                }}
              >
                {scene.items[0]}
              </div>
            ) : null}
          </div>
        )}
      </div>
    </Stage>
  );
});
