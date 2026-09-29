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
import { diagramLabelLines, orbitNodes } from "@/production/diagram-geometry";
import { resolveMotionDirection } from "@/production/motion";

export function DiagramMotionScene({
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
    Boolean(scene.visual),
    scene.items,
  );
  if (!direction || !scene.items) return null;
  const items = scene.items;
  const isOrbit = direction.recipeId === "diagram-orbit";
  const titleProgress = spring({
    frame: frame - 2,
    fps,
    config: { damping: 25, stiffness: 115 },
  });
  const positions = orbitNodes(items.length - 1);
  const side = Math.min(width * 0.65, height * 0.55, 720);

  return (
    <Stage
      tokens={{ ...tokens, foreground: "#f7f3ec" }}
      durationInFrames={durationInFrames}
      backdrop={
        <AbsoluteFill
          style={{
            background:
              "radial-gradient(circle at 25% 15%, #283452, #101626 48%, #080d19)",
          }}
        />
      }
      contentStyle={{ justifyContent: "center" }}
    >
      <div
        data-motion-recipe={direction.recipeId}
        data-motion-version={direction.version}
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          gap: Math.min(height * 0.035, 36),
          color: "#f7f3ec",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 15,
            color: tokens.accent,
            fontSize: Math.min(width * 0.023, 25),
            fontWeight: 850,
            letterSpacing: ".17em",
            textTransform: "uppercase",
            opacity: titleProgress,
          }}
        >
          <span style={{ width: 50, height: 3, background: tokens.accent }} />
          {isOrbit ? "Connections" : "The path"}
        </div>
        {scene.text.trim() && (
          <h2
            style={{
              margin: 0,
              maxWidth: "96%",
              fontSize: Math.min(width * 0.063, height * 0.07, 70),
              lineHeight: 1.04,
              letterSpacing: "-.04em",
              fontWeight: 800,
              opacity: titleProgress,
              transform: `translateY(${(1 - titleProgress) * 28}px)`,
            }}
          >
            {scene.text}
          </h2>
        )}
        {isOrbit ? (
          <svg
            viewBox="0 0 1000 1000"
            style={{
              width: side,
              height: side,
              maxWidth: "100%",
              alignSelf: "center",
              overflow: "visible",
            }}
          >
            <circle
              cx="500"
              cy="500"
              r="375"
              fill="none"
              stroke="rgba(255,255,255,.12)"
              strokeWidth="2"
              strokeDasharray="6 12"
            />
            {positions.map((point, index) => {
              const progress = spring({
                frame: frame - 11 - index * 5,
                fps,
                config: { damping: 27, stiffness: 86 },
              });
              return (
                <g key={`link-${index}`} opacity={progress}>
                  <path
                    d={`M 500 500 Q ${(point.x + 500) / 2 + 45} ${(point.y + 500) / 2 - 45} ${point.x} ${point.y}`}
                    fill="none"
                    stroke={tokens.accent}
                    strokeWidth="4"
                    strokeLinecap="round"
                    strokeDasharray="700"
                    strokeDashoffset={700 * (1 - progress)}
                  />
                  <circle
                    cx={point.x}
                    cy={point.y}
                    r="112"
                    fill="#1d2940"
                    stroke={tokens.accentSecondary}
                    strokeWidth="3"
                  />
                  <text
                    x={point.x}
                    y={point.y}
                    fill="#f7f3ec"
                    textAnchor="middle"
                    fontSize="39"
                    fontWeight="750"
                  >
                    {diagramLabelLines(items[index + 1]).map(
                      (line, lineIndex, lines) => (
                        <tspan
                          key={lineIndex}
                          x={point.x}
                          dy={
                            lineIndex === 0
                              ? lines.length === 1
                                ? 13
                                : -8
                              : 44
                          }
                        >
                          {line}
                        </tspan>
                      ),
                    )}
                  </text>
                </g>
              );
            })}
            <circle
              cx="500"
              cy="500"
              r="150"
              fill="#101a2c"
              stroke={tokens.accent}
              strokeWidth="8"
              opacity={titleProgress}
            />
            <text
              x="500"
              y="500"
              fill="#fff"
              textAnchor="middle"
              fontSize="47"
              fontWeight="850"
              opacity={titleProgress}
            >
              {diagramLabelLines(items[0]).map((line, lineIndex, lines) => (
                <tspan
                  key={lineIndex}
                  x="500"
                  dy={lineIndex === 0 ? (lines.length === 1 ? 17 : -9) : 54}
                >
                  {line}
                </tspan>
              ))}
            </text>
          </svg>
        ) : (
          <div
            style={{
              position: "relative",
              display: "flex",
              flexDirection: "column",
              gap: Math.min(height * 0.014, 18),
              width: "100%",
              maxWidth: 1100,
            }}
          >
            <svg
              aria-hidden
              style={{
                position: "absolute",
                left: 36,
                top: 36,
                bottom: 36,
                height: "calc(100% - 72px)",
                width: 4,
                overflow: "visible",
              }}
            >
              <line
                x1="2"
                y1="0"
                x2="2"
                y2="100%"
                stroke={tokens.accent}
                strokeWidth="4"
                opacity=".75"
              />
            </svg>
            {items.map((item, index) => {
              const progress = spring({
                frame: frame - 8 - index * 5,
                fps,
                config: { damping: 26, stiffness: 105 },
              });
              return (
                <div
                  key={`${item}-${index}`}
                  style={{
                    position: "relative",
                    display: "flex",
                    alignItems: "center",
                    gap: 22,
                    minHeight: Math.min(height * 0.105, 118),
                    padding: "14px 28px 14px 0",
                    opacity: progress,
                    transform: `translateX(${(1 - progress) * 46}px)`,
                  }}
                >
                  <div
                    style={{
                      zIndex: 1,
                      display: "grid",
                      placeItems: "center",
                      width: 76,
                      height: 76,
                      flexShrink: 0,
                      borderRadius: "50%",
                      background: tokens.accent,
                      color: "#07111a",
                      fontSize: 26,
                      fontWeight: 900,
                    }}
                  >
                    {String(index + 1).padStart(2, "0")}
                  </div>
                  <div
                    style={{
                      flex: 1,
                      padding: "20px 26px",
                      border: "1px solid rgba(255,255,255,.2)",
                      borderRadius: 22,
                      background: "rgba(20,32,52,.88)",
                      boxShadow: "0 18px 42px rgba(0,0,0,.2)",
                      fontSize: Math.min(width * 0.038, 43),
                      fontWeight: 700,
                    }}
                  >
                    {item}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </Stage>
  );
}
