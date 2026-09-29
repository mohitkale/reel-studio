"use client";

import * as React from "react";
import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";

import { Stage } from "@/compositions/components/stage";
import type { TemplateProps } from "@/compositions/types";
import { MOTION_EVENT_TIMINGS } from "@/production/motion-events";
import { resolveMotionDirection } from "@/production/motion";

export function TypeMotionScene({
  scene,
  tokens,
  durationInFrames,
}: TemplateProps) {
  const frame = useCurrentFrame();
  const { width, height, fps } = useVideoConfig();
  const direction = resolveMotionDirection(
    scene.motion,
    scene.text,
    scene.chart,
    Boolean(scene.visual || scene.items?.length),
  );
  const impact = direction?.recipeId === "type-impact";
  const timing =
    MOTION_EVENT_TIMINGS.remotion[impact ? "type-impact" : "type-editorial"];
  const hasMedia = Boolean(scene.background?.url);
  const portrait = height > width;
  const enter = spring({
    frame: frame - timing.reveal,
    fps,
    config: {
      damping: impact ? 18 : 26,
      stiffness: impact ? 140 : 80,
      mass: impact ? 0.75 : 1.1,
    },
  });
  const accent = spring({
    frame: frame - 2,
    fps,
    config: { damping: 24, stiffness: 115 },
  });
  const rule = spring({
    frame: frame - MOTION_EVENT_TIMINGS.remotion["type-impact"].impact!,
    fps,
    config: { damping: 22, stiffness: 110 },
  });
  const index = String((scene.order ?? 0) + 1).padStart(2, "0");
  const background = impact ? "#0b0c12" : "#f2ece2";
  const foreground = impact || hasMedia ? "#fffdf7" : "#241d19";

  return (
    <Stage
      tokens={tokens}
      background={scene.background}
      backdrop={<AbsoluteFill style={{ background }} />}
      durationInFrames={durationInFrames}
      contentStyle={{ alignItems: "stretch", justifyContent: "center" }}
    >
      <div
        data-motion-recipe={direction?.recipeId}
        data-motion-version={direction?.version}
        style={{
          position: "relative",
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-start",
          justifyContent: "center",
          gap: impact ? (portrait ? 48 : 30) : portrait ? 62 : 36,
          width: "100%",
          minHeight: "64%",
          paddingLeft: impact ? 0 : 32,
          color: foreground,
          textAlign: "left",
        }}
      >
        {impact ? (
          <div
            aria-hidden
            style={{
              position: "absolute",
              left: "-11%",
              top: "9%",
              width: "122%",
              height: "27%",
              background: tokens.accent,
              opacity: 0.88,
              transform: `rotate(-11deg) scaleX(${accent})`,
              transformOrigin: "left center",
            }}
          />
        ) : (
          <div
            aria-hidden
            style={{
              position: "absolute",
              top: 0,
              bottom: 0,
              left: 0,
              width: 3,
              background: tokens.accent,
              transform: `scaleY(${accent})`,
              transformOrigin: "top center",
            }}
          />
        )}
        <div
          style={{
            position: "relative",
            display: "flex",
            alignItems: "center",
            gap: impact ? 18 : 28,
            fontSize: portrait ? 21 : 19,
            fontWeight: 800,
            letterSpacing: ".16em",
            textTransform: "uppercase",
            opacity: enter,
            transform: `translateY(${(1 - enter) * 16}px)`,
          }}
        >
          <span
            style={
              impact
                ? {
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    width: 54,
                    height: 54,
                    borderRadius: "50%",
                    background: tokens.accent,
                    color: "#0b0c12",
                    letterSpacing: 0,
                  }
                : { color: tokens.accent, letterSpacing: 0 }
            }
          >
            {index}
          </span>
          {scene.role ?? "statement"}
        </div>
        <div
          style={{ position: "relative", maxWidth: "100%", overflow: "hidden" }}
        >
          <h2
            style={{
              maxWidth: "100%",
              fontFamily: tokens.fontFamily,
              fontSize: impact
                ? Math.min(portrait ? width * 0.087 : width * 0.066, 112)
                : Math.min(portrait ? width * 0.067 : width * 0.053, 86),
              fontWeight: impact ? 950 : 600,
              lineHeight: impact ? 0.99 : 1.09,
              letterSpacing: impact ? "-.055em" : "-.04em",
              textTransform: impact ? "uppercase" : "none",
              overflowWrap: "anywhere",
              color: foreground,
              transform: impact
                ? `translateX(${(1 - enter) * -110}px) scale(${0.93 + enter * 0.07})`
                : `translateY(${(1 - enter) * 80}px)`,
              opacity: interpolate(enter, [0, 0.28, 1], [0, 0.7, 1], {
                extrapolateRight: "clamp",
              }),
              textShadow: impact ? "6px 7px 0 rgba(0,0,0,.24)" : undefined,
            }}
          >
            {scene.text}
          </h2>
        </div>
        {impact ? (
          <div
            style={{
              width: "40%",
              maxWidth: 360,
              height: 12,
              background: tokens.accentSecondary,
              transform: `scaleX(${rule})`,
              transformOrigin: "left center",
            }}
          />
        ) : (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 16,
              opacity: rule * 0.58,
              fontSize: 18,
              fontWeight: 700,
              letterSpacing: ".18em",
            }}
          >
            <span style={{ width: 48, height: 2, background: foreground }} />
            {index}
          </div>
        )}
      </div>
    </Stage>
  );
}
