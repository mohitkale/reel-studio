"use client";

import * as React from "react";
import {
  AbsoluteFill,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";

import { Stage } from "@/compositions/components/stage";
import type { TemplateProps } from "@/compositions/types";
import {
  formatMotionValue,
  motionBarScaleMax,
  motionSpotlightFraction,
  resolveMotionDirection,
} from "@/production/motion";

export function DataMotionScene({
  scene,
  tokens,
  durationInFrames,
}: TemplateProps) {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const direction = resolveMotionDirection(
    scene.motion,
    scene.text,
    scene.chart,
    Boolean(scene.visual || scene.items?.length),
  );
  const chart = scene.chart;
  if (!direction || !chart) return null;
  const series = chart.series[0];
  const bars = direction.recipeId === "data-bars";
  const portrait = height > width;
  const enter = spring({
    frame: frame - 4,
    fps,
    config: { damping: 24, stiffness: 115 },
  });
  const orbit = spring({
    frame: frame - 9,
    fps,
    config: { damping: 30, stiffness: 65 },
  });
  const copy = scene.text.trim();
  const value = formatMotionValue(series.values[0], series.unit);
  const max = motionBarScaleMax(series);
  const orbitFraction = motionSpotlightFraction(series);
  const source = chart.sourceAttribution?.trim();

  return (
    <Stage
      tokens={{ ...tokens, foreground: "#f3f7f7" }}
      background={scene.background}
      backdrop={
        <AbsoluteFill
          style={{
            background:
              "radial-gradient(circle at 84% 18%, #17343e, #07151d 58%, #050d14)",
          }}
        />
      }
      durationInFrames={durationInFrames}
      contentStyle={{ alignItems: "stretch", justifyContent: "center" }}
    >
      <div
        data-motion-recipe={direction.recipeId}
        data-motion-version={direction.version}
        style={{
          position: "relative",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          gap: bars ? (portrait ? 34 : 20) : portrait ? 44 : 28,
          minHeight: "72%",
          width: "100%",
          color: "#f3f7f7",
          textAlign: "left",
        }}
      >
        {!bars && (
          <svg
            aria-hidden
            viewBox="0 0 360 360"
            style={{
              position: "absolute",
              width: "70%",
              maxWidth: 640,
              right: "-5%",
              top: "8%",
              opacity: 0.64,
              transform: "rotate(-90deg)",
            }}
          >
            {orbitFraction !== undefined && (
              <circle
                cx="180"
                cy="180"
                r="142"
                fill="none"
                stroke="rgba(255,255,255,.12)"
                strokeWidth="3"
              />
            )}
            <circle
              cx="180"
              cy="180"
              r="142"
              fill="none"
              stroke={tokens.accent}
              strokeWidth="3"
              strokeDasharray="893"
              strokeDashoffset={893 * (1 - orbit * (orbitFraction ?? 1))}
              strokeLinecap="round"
            />
          </svg>
        )}
        <div
          style={{
            position: "relative",
            display: "flex",
            alignItems: "center",
            gap: 14,
            color: tokens.accent,
            fontSize: portrait ? 22 : 19,
            fontWeight: 800,
            letterSpacing: ".15em",
            textTransform: "uppercase",
            opacity: enter,
          }}
        >
          <span style={{ width: 48, height: 3, background: tokens.accent }} />
          {series.label || scene.role || "Data"}
        </div>
        {bars ? (
          <>
            {copy && (
              <h2
                style={{
                  position: "relative",
                  margin: 0,
                  maxWidth: "100%",
                  fontSize: Math.min(
                    portrait ? width * 0.06 : width * 0.038,
                    62,
                  ),
                  lineHeight: 1.08,
                  fontWeight: 750,
                  opacity: enter,
                  transform: `translateY(${(1 - enter) * 24}px)`,
                }}
              >
                {copy}
              </h2>
            )}
            <div
              style={{
                position: "relative",
                display: "flex",
                flexDirection: "column",
                gap: portrait ? 22 : 15,
                width: "100%",
              }}
            >
              {series.values.map((item, index) => {
                const progress = spring({
                  frame: frame - 10 - index * 4,
                  fps,
                  config: { damping: 26, stiffness: 95 },
                });
                return (
                  <div
                    key={`${chart.labels[index]}-${index}`}
                    style={{
                      opacity: progress,
                      transform: `translateY(${(1 - progress) * 20}px)`,
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        gap: 20,
                        marginBottom: 8,
                        fontSize: portrait ? 25 : 23,
                        fontWeight: 650,
                      }}
                    >
                      <span>{chart.labels[index]}</span>
                      <strong>{formatMotionValue(item, series.unit)}</strong>
                    </div>
                    <div
                      style={{
                        width: "100%",
                        height: portrait ? 18 : 15,
                        borderRadius: 100,
                        overflow: "hidden",
                        background: "rgba(255,255,255,.13)",
                      }}
                    >
                      <div
                        style={{
                          width: `${(item / max) * 100}%`,
                          height: "100%",
                          borderRadius: "inherit",
                          transform: `scaleX(${progress})`,
                          transformOrigin: "left center",
                          background: `linear-gradient(90deg, ${tokens.accent}, ${tokens.accentSecondary})`,
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        ) : (
          <>
            <div
              style={{
                position: "relative",
                maxWidth: "100%",
                color: "#f3f7f7",
                fontSize: Math.min(
                  280,
                  (width * 1.15) / Math.max(5, value.length),
                ),
                lineHeight: 0.85,
                fontWeight: 950,
                letterSpacing: "-.075em",
                whiteSpace: "nowrap",
                opacity: enter,
                transform: `translateY(${(1 - enter) * 46}px) scale(${0.86 + enter * 0.14})`,
                transformOrigin: "left center",
              }}
            >
              {value}
            </div>
            <div
              style={{
                position: "relative",
                color: tokens.accent,
                fontSize: portrait ? 28 : 25,
                fontWeight: 800,
                letterSpacing: ".08em",
                textTransform: "uppercase",
                opacity: enter,
              }}
            >
              {chart.labels[0]}
            </div>
            {copy && (
              <h2
                style={{
                  position: "relative",
                  margin: 0,
                  maxWidth: "100%",
                  fontSize: Math.min(
                    portrait ? width * 0.052 : width * 0.038,
                    62,
                  ),
                  lineHeight: 1.08,
                  fontWeight: 750,
                  opacity: enter,
                  transform: `translateY(${(1 - enter) * 22}px)`,
                }}
              >
                {copy}
              </h2>
            )}
          </>
        )}
        {source && (
          <div
            style={{
              position: "relative",
              color: "#a8c0c5",
              fontSize: portrait ? 20 : 18,
              opacity: enter,
            }}
          >
            Source: {source}
          </div>
        )}
      </div>
    </Stage>
  );
}
