"use client";

import * as React from "react";
import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";

import { AnimatedText } from "@/compositions/components/animated-text";
import { Stage } from "@/compositions/components/stage";
import type { TemplateProps } from "@/compositions/types";

/** Remotion implementation of Cinematic Brand 1.0.0 scene roles. */
export const CinematicBrandScene = React.memo(function CinematicBrandScene({
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
    config: { damping: 210, stiffness: 72, mass: 1 },
  });
  const exit = interpolate(
    frame,
    [Math.max(0, durationInFrames - 20), durationInFrames],
    [1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );
  const role = scene.role ?? "feature";
  const items = (scene.items ?? [])
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 3);
  const cinematicTokens = {
    ...tokens,
    foreground: "#fff8ed",
    muted: "#c7bbaa",
  };

  return (
    <Stage
      tokens={cinematicTokens}
      background={scene.background}
      mood={scene.mood ?? "dramatic"}
      treatmentSeed={scene.order}
      durationInFrames={durationInFrames}
      contentStyle={{
        alignItems: "stretch",
        justifyContent: role === "hero" ? "flex-end" : "center",
      }}
    >
      <div
        data-production-preset="cinematic-brand"
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
            fontSize: portrait ? 18 : 15,
            fontWeight: 700,
            letterSpacing: ".22em",
            textTransform: "uppercase",
            opacity: enter,
          }}
        >
          {role}
        </div>
        {role === "testimonial" ? (
          <div
            style={{
              maxWidth: 1040,
              color: "#fff8ed",
              fontFamily: "Georgia, serif",
            }}
          >
            <div
              style={{
                color: tokens.accent,
                fontSize: portrait ? 140 : 100,
                lineHeight: 0.55,
                opacity: enter,
              }}
            >
              “
            </div>
            <div
              style={{
                fontSize: portrait ? 68 : 56,
                lineHeight: 1.14,
                fontStyle: "italic",
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
                  color: "#c7bbaa",
                  fontFamily: cinematicTokens.fontFamily,
                  fontSize: portrait ? 26 : 21,
                }}
              >
                — {scene.visual}
              </div>
            ) : null}
          </div>
        ) : role === "feature" && items.length ? (
          <div>
            <AnimatedText
              text={scene.text}
              emphasis={scene.emphasis}
              tokens={cinematicTokens}
              fontSize={portrait ? 70 : 58}
              fontWeight={650}
              align="left"
              startDelay={3}
              maxWidth={1050}
            />
            <div
              style={{
                display: "grid",
                gridTemplateColumns: portrait ? "1fr" : "repeat(3, 1fr)",
                gap: 16,
                marginTop: 44,
              }}
            >
              {items.map((item, index) => (
                <div
                  key={item}
                  style={{
                    padding: portrait ? "24px 26px" : "22px",
                    borderTop: `2px solid ${tokens.accent}`,
                    background: "rgba(7,7,8,.45)",
                    color: "#fff8ed",
                    fontSize: portrait ? 32 : 26,
                    lineHeight: 1.25,
                    opacity: spring({
                      frame: frame - 9 - index * 6,
                      fps,
                      config: { damping: 210, stiffness: 75 },
                    }),
                  }}
                >
                  {item}
                </div>
              ))}
            </div>
          </div>
        ) : role === "logo" ? (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 34,
              textAlign: "center",
            }}
          >
            <div
              style={{
                width: portrait ? 150 : 120,
                height: portrait ? 150 : 120,
                display: "grid",
                placeItems: "center",
                border: `2px solid ${tokens.accent}`,
                borderRadius: "50%",
                color: tokens.accent,
                fontFamily: "Georgia, serif",
                fontSize: portrait ? 74 : 60,
                opacity: enter,
                transform: `scale(${0.75 + enter * 0.25})`,
              }}
            >
              {scene.visual?.slice(0, 2) || "RS"}
            </div>
            <AnimatedText
              text={scene.text}
              emphasis={scene.emphasis}
              tokens={cinematicTokens}
              fontSize={portrait ? 64 : 54}
              fontWeight={600}
              startDelay={6}
              maxWidth={980}
            />
          </div>
        ) : (
          <div
            style={{
              paddingBottom: role === "hero" ? (portrait ? 42 : 18) : 0,
            }}
          >
            <AnimatedText
              text={scene.text}
              emphasis={scene.emphasis}
              tokens={cinematicTokens}
              fontSize={portrait ? 86 : 74}
              fontWeight={620}
              align="left"
              startDelay={4}
              maxWidth={1050}
            />
          </div>
        )}
      </div>
    </Stage>
  );
});
