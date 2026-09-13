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

function PaperBackdrop({ accent }: { accent: string }) {
  return (
    <AbsoluteFill
      style={{
        background:
          "radial-gradient(85% 55% at 18% 0%, #fffdf8 0%, transparent 70%), linear-gradient(155deg, #f5f0e5, #e8dfce)",
      }}
    >
      <AbsoluteFill
        style={{
          opacity: 0.32,
          backgroundImage:
            "linear-gradient(rgba(31,27,21,.07) 1px, transparent 1px)",
          backgroundSize: "100% 48px",
        }}
      />
      <div
        style={{
          position: "absolute",
          top: "8%",
          right: "7%",
          width: 96,
          height: 96,
          borderTop: `2px solid ${accent}`,
          borderRight: `2px solid ${accent}`,
          opacity: 0.55,
        }}
      />
    </AbsoluteFill>
  );
}

/** Remotion implementation of Editorial Explainer 1.0.0 scene roles. */
export const EditorialExplainerScene = React.memo(
  function EditorialExplainerScene({
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
      config: { damping: 200, stiffness: 85, mass: 0.9 },
    });
    const exit = interpolate(
      frame,
      [Math.max(0, durationInFrames - 15), durationInFrames],
      [1, 0],
      { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
    );
    const role = scene.role ?? "explanation";
    const items = (scene.items ?? [])
      .map((item) => item.trim())
      .filter(Boolean)
      .slice(0, 5);
    const ink = "#201d18";
    const muted = "#6d6559";
    const editorialTokens = {
      ...tokens,
      foreground: ink,
      muted,
      accentForeground: "#fffaf0",
    };

    return (
      <Stage
        tokens={editorialTokens}
        backdrop={<PaperBackdrop accent={tokens.accent} />}
        durationInFrames={durationInFrames}
        contentStyle={{ alignItems: "stretch", justifyContent: "center" }}
      >
        <div
          data-production-preset="editorial-explainer"
          data-scene-role={role}
          style={{
            width: "100%",
            maxWidth: 1120,
            margin: "0 auto",
            color: ink,
            opacity: exit,
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 14,
              marginBottom: portrait ? 42 : 26,
              color: muted,
              fontSize: portrait ? 20 : 16,
              fontWeight: 750,
              letterSpacing: ".16em",
              textTransform: "uppercase",
              opacity: enter,
            }}
          >
            <span style={{ width: 44, height: 2, background: tokens.accent }} />
            {role}
          </div>

          {role === "diagram" && items.length >= 2 ? (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: portrait ? 34 : 24,
              }}
            >
              <AnimatedText
                text={scene.text}
                emphasis={scene.emphasis}
                tokens={editorialTokens}
                fontSize={portrait ? 64 : 50}
                fontWeight={760}
                align="left"
                startDelay={2}
                maxWidth={1050}
              />
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: portrait
                    ? "1fr"
                    : `repeat(${Math.min(items.length, 4)}, 1fr)`,
                  gap: portrait ? 12 : 18,
                }}
              >
                {items.map((item, index) => {
                  const itemIn = spring({
                    frame: frame - 8 - index * 6,
                    fps,
                    config: { damping: 200, stiffness: 90 },
                  });
                  return (
                    <div
                      key={item}
                      style={{
                        position: "relative",
                        padding: portrait ? "22px 24px" : "26px 22px",
                        border: "1px solid rgba(32,29,24,.18)",
                        borderRadius: 8,
                        background: "rgba(255,253,248,.62)",
                        fontSize: portrait ? 34 : 26,
                        fontWeight: 650,
                        lineHeight: 1.2,
                        opacity: itemIn,
                        transform: `translateY(${(1 - itemIn) * 18}px)`,
                      }}
                    >
                      <span
                        style={{
                          display: "block",
                          marginBottom: 10,
                          color: tokens.accent,
                          fontSize: 16,
                          letterSpacing: ".12em",
                        }}
                      >
                        {String(index + 1).padStart(2, "0")}
                      </span>
                      {item}
                    </div>
                  );
                })}
              </div>
            </div>
          ) : role === "quote" ? (
            <div style={{ maxWidth: 1020 }}>
              <div
                style={{
                  color: tokens.accent,
                  fontFamily: "Georgia, serif",
                  fontSize: portrait ? 150 : 110,
                  lineHeight: 0.6,
                  opacity: enter,
                }}
              >
                “
              </div>
              <div
                style={{
                  marginTop: 26,
                  fontFamily: "Georgia, serif",
                  fontSize: portrait ? 70 : 56,
                  fontStyle: "italic",
                  lineHeight: 1.14,
                  letterSpacing: "-.025em",
                  opacity: enter,
                  transform: `translateY(${(1 - enter) * 24}px)`,
                }}
              >
                {scene.text}
              </div>
              {scene.visual ? (
                <div
                  style={{
                    marginTop: 34,
                    color: muted,
                    fontSize: portrait ? 28 : 22,
                  }}
                >
                  — {scene.visual}
                </div>
              ) : null}
            </div>
          ) : role === "summary" && items.length ? (
            <div>
              <AnimatedText
                text={scene.text}
                emphasis={scene.emphasis}
                tokens={editorialTokens}
                fontSize={portrait ? 68 : 54}
                fontWeight={780}
                align="left"
                startDelay={2}
                maxWidth={1050}
              />
              <div
                style={{
                  marginTop: 42,
                  borderTop: "1px solid rgba(32,29,24,.2)",
                }}
              >
                {items.map((item, index) => (
                  <div
                    key={item}
                    style={{
                      display: "grid",
                      gridTemplateColumns: "54px 1fr",
                      gap: 16,
                      padding: "20px 0",
                      borderBottom: "1px solid rgba(32,29,24,.15)",
                      color: ink,
                      fontSize: portrait ? 34 : 27,
                      opacity: spring({
                        frame: frame - 8 - index * 5,
                        fps,
                        config: { damping: 200, stiffness: 90 },
                      }),
                    }}
                  >
                    <span style={{ color: tokens.accent }}>
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    {item}
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div
              style={{
                display: "grid",
                gridTemplateColumns:
                  role === "explanation" && !portrait ? "5px 1fr" : "1fr",
                gap: 34,
                alignItems: "stretch",
              }}
            >
              {role === "explanation" && !portrait ? (
                <div
                  style={{
                    background: tokens.accent,
                    transform: `scaleY(${enter})`,
                    transformOrigin: "top",
                  }}
                />
              ) : null}
              <AnimatedText
                text={scene.text}
                emphasis={scene.emphasis}
                tokens={editorialTokens}
                fontSize={
                  role === "headline"
                    ? portrait
                      ? 88
                      : 76
                    : portrait
                      ? 70
                      : 58
                }
                fontWeight={role === "headline" ? 820 : 680}
                align="left"
                startDelay={2}
                maxWidth={1080}
              />
            </div>
          )}
        </div>
      </Stage>
    );
  },
);
