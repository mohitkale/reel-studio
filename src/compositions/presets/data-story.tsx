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
import type { SceneChartData, TemplateProps } from "@/compositions/types";

function DataBackdrop({ accent }: { accent: string }) {
  return (
    <AbsoluteFill
      style={{
        background: "linear-gradient(145deg, #07131d, #0a1d28 58%, #102836)",
      }}
    >
      <AbsoluteFill
        style={{
          opacity: 0.2,
          backgroundImage: `linear-gradient(${accent}22 1px, transparent 1px), linear-gradient(90deg, ${accent}22 1px, transparent 1px)`,
          backgroundSize: "56px 56px",
        }}
      />
    </AbsoluteFill>
  );
}

function formatValue(value: number, unit = "") {
  return `${new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(value)}${unit}`;
}

function Chart({
  chart,
  accent,
  secondary,
  frame,
  fps,
  portrait,
}: {
  chart: SceneChartData;
  accent: string;
  secondary: string;
  frame: number;
  fps: number;
  portrait: boolean;
}) {
  const series = chart.series[0];
  const values = series.values.slice(0, 8);
  const magnitude = Math.max(1, ...values.map((value) => Math.abs(value)));
  return (
    <div style={{ width: "100%" }}>
      <div
        style={{
          height: portrait ? 420 : 300,
          display: "flex",
          alignItems: "flex-end",
          gap: portrait ? 14 : 20,
        }}
      >
        {values.map((value, index) => {
          const reveal = spring({
            frame: frame - 5 - index * 3,
            fps,
            config: { damping: 150, stiffness: 100 },
          });
          return (
            <div
              key={`${chart.labels[index]}-${index}`}
              style={{
                flex: 1,
                minWidth: 0,
                height: "100%",
                display: "flex",
                flexDirection: "column",
                justifyContent: "flex-end",
                alignItems: "center",
                gap: 10,
              }}
            >
              <strong
                style={{ color: "#f4fbff", fontSize: portrait ? 24 : 21 }}
              >
                {formatValue(value, series.unit)}
              </strong>
              <div
                style={{
                  width: "100%",
                  height: `${Math.max(8, (Math.abs(value) / magnitude) * 82)}%`,
                  minHeight: 12,
                  borderRadius: "12px 12px 4px 4px",
                  background: `linear-gradient(180deg, ${accent}, ${secondary})`,
                  transform: `scaleY(${Math.max(0.02, reveal)})`,
                  transformOrigin: "bottom",
                }}
              />
              <span
                style={{
                  width: "100%",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  color: "#9fb4c1",
                  fontSize: portrait ? 20 : 18,
                  textAlign: "center",
                  whiteSpace: "nowrap",
                }}
              >
                {chart.labels[index]}
              </span>
            </div>
          );
        })}
      </div>
      {chart.sourceAttribution ? (
        <div
          style={{
            marginTop: 24,
            color: "#8299a7",
            fontSize: portrait ? 20 : 16,
          }}
        >
          Source: {chart.sourceAttribution}
        </div>
      ) : null}
    </div>
  );
}

/** Remotion implementation of Data Story 1.0.0 scene roles. */
export const DataStoryScene = React.memo(function DataStoryScene({
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
    config: { damping: 170, stiffness: 105 },
  });
  const exit = interpolate(
    frame,
    [Math.max(0, durationInFrames - 12), durationInFrames],
    [1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );
  const role = scene.role ?? "takeaway";
  const dataTokens = { ...tokens, foreground: "#f4fbff", muted: "#9fb4c1" };
  const chart = scene.chart;

  return (
    <Stage
      tokens={dataTokens}
      backdrop={<DataBackdrop accent={tokens.accent} />}
      durationInFrames={durationInFrames}
      contentStyle={{ alignItems: "stretch", justifyContent: "center" }}
    >
      <div
        data-production-preset="data-story"
        data-scene-role={role}
        style={{
          width: "100%",
          maxWidth: 1100,
          margin: "0 auto",
          opacity: exit,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 14,
            marginBottom: portrait ? 40 : 26,
            color: tokens.accent,
            fontSize: portrait ? 20 : 16,
            fontWeight: 850,
            letterSpacing: ".16em",
            textTransform: "uppercase",
            opacity: enter,
          }}
        >
          <span style={{ width: 38, height: 3, background: tokens.accent }} />
          {role}
        </div>
        {role === "metric" && scene.visual ? (
          <div>
            <div
              style={{
                color: tokens.accent,
                fontSize: portrait ? 180 : 150,
                fontWeight: 900,
                lineHeight: 0.86,
                letterSpacing: "-.06em",
                opacity: enter,
                transform: `translateY(${(1 - enter) * 50}px)`,
              }}
            >
              {scene.visual}
            </div>
            <div style={{ marginTop: 54 }}>
              <AnimatedText
                text={scene.text}
                emphasis={scene.emphasis}
                tokens={dataTokens}
                fontSize={portrait ? 58 : 50}
                fontWeight={760}
                align="left"
                startDelay={8}
                maxWidth={980}
              />
            </div>
          </div>
        ) : (role === "chart" || role === "comparison") && chart ? (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: portrait ? 38 : 28,
            }}
          >
            <AnimatedText
              text={scene.text}
              emphasis={scene.emphasis}
              tokens={dataTokens}
              fontSize={portrait ? 58 : 48}
              fontWeight={800}
              align="left"
              startDelay={1}
              maxWidth={1040}
            />
            <Chart
              chart={chart}
              accent={tokens.accent}
              secondary={tokens.accentSecondary}
              frame={frame}
              fps={fps}
              portrait={portrait}
            />
          </div>
        ) : (
          <div
            style={{
              borderLeft: `7px solid ${tokens.accent}`,
              paddingLeft: portrait ? 34 : 28,
            }}
          >
            <AnimatedText
              text={scene.text}
              emphasis={scene.emphasis}
              tokens={dataTokens}
              fontSize={portrait ? 76 : 66}
              fontWeight={860}
              align="left"
              startDelay={2}
              maxWidth={1040}
            />
          </div>
        )}
      </div>
    </Stage>
  );
});
