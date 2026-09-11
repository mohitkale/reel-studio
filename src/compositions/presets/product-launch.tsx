"use client";

import * as React from "react";
import {
  Img,
  OffthreadVideo,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";

import { AnimatedText } from "@/compositions/components/animated-text";
import { Stage } from "@/compositions/components/stage";
import type { TemplateProps } from "@/compositions/types";

function ProductMedia({ scene }: Pick<TemplateProps, "scene">) {
  const media = scene.background;
  if (!media?.url) return null;
  const style: React.CSSProperties = {
    width: "100%",
    height: "100%",
    objectFit: "cover",
  };
  return media.type === "video" ? (
    <OffthreadVideo src={media.url} muted={media.muted ?? true} style={style} />
  ) : (
    <Img src={media.url} style={style} />
  );
}

function ProductFrame({
  scene,
  enter,
}: Pick<TemplateProps, "scene"> & { enter: number }) {
  return (
    <div
      style={{
        width: "100%",
        maxWidth: 980,
        aspectRatio: "16 / 10",
        padding: 14,
        borderRadius: 36,
        background:
          "linear-gradient(145deg, rgba(255,255,255,.2), rgba(255,255,255,.04))",
        border: "1px solid rgba(255,255,255,.22)",
        boxShadow: "0 48px 120px rgba(0,0,0,.48)",
        opacity: enter,
        transform: `perspective(1400px) rotateX(${(1 - enter) * 8}deg) translateY(${(1 - enter) * 50}px) scale(${0.94 + enter * 0.06})`,
      }}
    >
      <div
        style={{
          display: "flex",
          gap: 9,
          alignItems: "center",
          height: 38,
          padding: "0 14px",
          borderRadius: "23px 23px 0 0",
          background: "rgba(8,10,18,.94)",
        }}
      >
        {["#ff5f57", "#febc2e", "#28c840"].map((color) => (
          <span
            key={color}
            style={{
              width: 10,
              height: 10,
              borderRadius: 99,
              background: color,
            }}
          />
        ))}
      </div>
      <div
        style={{
          height: "calc(100% - 38px)",
          overflow: "hidden",
          borderRadius: "0 0 23px 23px",
          background: "rgba(255,255,255,.08)",
        }}
      >
        <ProductMedia scene={scene} />
      </div>
    </div>
  );
}

/** Remotion implementation of Product Launch 1.0.0 scene roles. */
export const ProductLaunchScene = React.memo(function ProductLaunchScene({
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
    config: { damping: 180, stiffness: 105, mass: 0.8 },
  });
  const exit = interpolate(
    frame,
    [Math.max(0, durationInFrames - 12), durationInFrames],
    [1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );
  const role = scene.role ?? "feature";
  const items = (scene.items ?? [])
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 4);
  const headlineSize = portrait ? 82 : 72;

  return (
    <Stage
      tokens={tokens}
      mood={scene.mood ?? "tech"}
      treatmentSeed={scene.order}
      durationInFrames={durationInFrames}
      contentStyle={{ alignItems: "center", justifyContent: "center" }}
    >
      <div
        data-production-preset="product-launch"
        data-scene-role={role}
        style={{
          width: "100%",
          maxWidth: 1120,
          display: "flex",
          flexDirection: "column",
          alignItems: role === "hook" || role === "cta" ? "center" : "stretch",
          gap: portrait ? 44 : 30,
          opacity: exit,
        }}
      >
        <div
          style={{
            alignSelf:
              role === "hook" || role === "cta" ? "center" : "flex-start",
            padding: "10px 16px",
            border: `1px solid ${tokens.accent}66`,
            borderRadius: 999,
            color: tokens.accent,
            background: `${tokens.accent}18`,
            fontSize: portrait ? 20 : 17,
            fontWeight: 800,
            letterSpacing: ".16em",
            textTransform: "uppercase",
            opacity: enter,
          }}
        >
          {role === "screenshot-demo" ? "Live product" : role.replace("-", " ")}
        </div>

        {role === "screenshot-demo" ? (
          <>
            <ProductFrame scene={scene} enter={enter} />
            <AnimatedText
              text={scene.text}
              emphasis={scene.emphasis}
              tokens={tokens}
              fontSize={portrait ? 54 : 44}
              fontWeight={750}
              startDelay={8}
              maxWidth={portrait ? 900 : 1060}
            />
          </>
        ) : role === "feature" && items.length ? (
          <>
            <AnimatedText
              text={scene.text}
              emphasis={scene.emphasis}
              tokens={tokens}
              fontSize={portrait ? 66 : 56}
              fontWeight={850}
              startDelay={3}
              maxWidth={1000}
            />
            <div
              style={{
                display: "grid",
                gridTemplateColumns: portrait ? "1fr" : "repeat(2, 1fr)",
                gap: 18,
              }}
            >
              {items.map((item, index) => {
                const itemIn = spring({
                  frame: frame - 7 - index * 5,
                  fps,
                  config: { damping: 200, stiffness: 100 },
                });
                return (
                  <div
                    key={item}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 20,
                      padding: portrait ? "26px 28px" : "20px 24px",
                      border: "1px solid rgba(255,255,255,.14)",
                      borderRadius: 24,
                      background: "rgba(9,12,22,.7)",
                      color: tokens.foreground,
                      fontSize: portrait ? 38 : 30,
                      fontWeight: 700,
                      opacity: itemIn,
                      transform: `translateY(${(1 - itemIn) * 24}px)`,
                    }}
                  >
                    <span style={{ color: tokens.accent, fontWeight: 900 }}>
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    {item}
                  </div>
                );
              })}
            </div>
          </>
        ) : role === "comparison" && items.length >= 2 ? (
          <>
            <AnimatedText
              text={scene.text}
              emphasis={scene.emphasis}
              tokens={tokens}
              fontSize={portrait ? 62 : 52}
              fontWeight={850}
              startDelay={2}
              maxWidth={1000}
            />
            <div
              style={{
                display: "grid",
                gridTemplateColumns: portrait ? "1fr" : "1fr 1fr",
                gap: 18,
              }}
            >
              {items.slice(0, 2).map((item, index) => (
                <div
                  key={item}
                  style={{
                    minHeight: portrait ? 180 : 150,
                    padding: 30,
                    borderRadius: 28,
                    border: `1px solid ${index === 1 ? tokens.accent + "88" : "rgba(255,255,255,.14)"}`,
                    background:
                      index === 1 ? `${tokens.accent}18` : "rgba(8,10,18,.72)",
                    color: tokens.foreground,
                    fontSize: portrait ? 40 : 32,
                    fontWeight: 750,
                    display: "flex",
                    alignItems: "center",
                    opacity: enter,
                    transform: `translateX(${(1 - enter) * (index ? 34 : -34)}px)`,
                  }}
                >
                  {item}
                </div>
              ))}
            </div>
          </>
        ) : (
          <>
            <AnimatedText
              text={scene.text}
              emphasis={scene.emphasis}
              tokens={tokens}
              fontSize={headlineSize}
              fontWeight={900}
              startDelay={3}
              maxWidth={portrait ? 900 : 1100}
            />
            {role === "cta" && scene.visual ? (
              <div
                style={{
                  padding: "18px 34px",
                  borderRadius: 999,
                  background: tokens.accent,
                  color: tokens.accentForeground,
                  fontSize: portrait ? 30 : 25,
                  fontWeight: 850,
                  opacity: enter,
                  transform: `translateY(${(1 - enter) * 20}px)`,
                }}
              >
                {scene.visual}
              </div>
            ) : null}
          </>
        )}
      </div>
    </Stage>
  );
});
