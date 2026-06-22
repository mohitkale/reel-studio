"use client";

import { AbsoluteFill, Img, interpolate, useCurrentFrame } from "remotion";

import type { TemplateProps } from "../types";
import { Stage } from "../components/stage";
import { AnimatedText } from "../components/animated-text";

/**
 * Image overlay: a full-bleed image with a slow Ken Burns zoom, a dark gradient
 * scrim for legibility, and an AnimatedText caption. When scene.visual is empty
 * the Stage gradient backdrop is used instead.
 */
export function ImageOverlay({ scene, tokens, durationInFrames }: TemplateProps) {
  const frame = useCurrentFrame();

  const scale = interpolate(frame, [0, durationInFrames], [1.0, 1.08], {
    extrapolateRight: "clamp",
  });

  const backdrop = scene.visual ? (
    <>
      <AbsoluteFill style={{ transform: `scale(${scale})` }}>
        <Img
          src={scene.visual}
          style={{ width: "100%", height: "100%", objectFit: "cover" }}
        />
      </AbsoluteFill>
      <AbsoluteFill
        style={{
          background:
            "linear-gradient(to top, rgba(0,0,0,0.88) 0%, rgba(0,0,0,0.25) 60%, rgba(0,0,0,0.1) 100%)",
        }}
      />
    </>
  ) : undefined;

  return (
    <Stage tokens={tokens} backdrop={backdrop}>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          height: "100%",
          justifyContent: scene.visual ? "flex-end" : "center",
        }}
      >
        <AnimatedText
          text={scene.text}
          emphasis={scene.emphasis}
          tokens={tokens}
          fontSize={scene.visual ? 88 : 108}
        />
      </div>
    </Stage>
  );
}
