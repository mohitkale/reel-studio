"use client";

import {
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { Lottie, type LottieAnimationData } from "@remotion/lottie";

import type { TemplateProps } from "../types";
import { Stage } from "../components/stage";
import { AnimatedText } from "../components/animated-text";
import pulse from "../assets/pulse.lottie.json";

const animationData = pulse as unknown as LottieAnimationData;

/**
 * Lottie explainer: a vector animation inside a glowing badge with an orbiting
 * conic ring, above a marker-highlighted caption. Spring entrance, fade exit.
 */
export function LottieExplainer({ scene, tokens, durationInFrames }: TemplateProps) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const badgeIn = spring({
    frame,
    fps,
    config: { damping: 200, stiffness: 90, mass: 0.9 },
  });
  const glow = 0.7 + Math.sin(frame / 14) * 0.3;
  const ringRotate = frame * 1.4;
  const exit = interpolate(
    frame,
    [durationInFrames - 12, durationInFrames],
    [1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );

  return (
    <Stage
      tokens={tokens}
      background={scene.background}
      durationInFrames={durationInFrames}
      contentStyle={{ alignItems: "center", justifyContent: "center" }}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 96,
          opacity: exit,
        }}
      >
        {/* Glowing animated badge */}
        <div
          style={{
            position: "relative",
            width: 560,
            height: 560,
            transform: `scale(${interpolate(badgeIn, [0, 1], [0.7, 1])})`,
            opacity: badgeIn,
          }}
        >
          <div
            style={{
              position: "absolute",
              inset: 40,
              borderRadius: "50%",
              background: `radial-gradient(circle, ${tokens.accent}66 0%, transparent 70%)`,
              filter: `blur(40px)`,
              opacity: glow,
            }}
          />
          <div
            style={{
              position: "absolute",
              inset: 0,
              borderRadius: "50%",
              background: `conic-gradient(from ${ringRotate}deg, ${tokens.accent}, ${tokens.accentSecondary}, ${tokens.accent})`,
              padding: 6,
              WebkitMask:
                "radial-gradient(circle, transparent 47%, #000 48%)",
              mask: "radial-gradient(circle, transparent 47%, #000 48%)",
            }}
          />
          <div
            style={{
              position: "absolute",
              inset: 70,
              borderRadius: "50%",
              background: "rgba(255,255,255,0.04)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              backdropFilter: "blur(2px)",
            }}
          >
            <div style={{ width: 320, height: 320 }}>
              <Lottie animationData={animationData} loop />
            </div>
          </div>
        </div>

        <AnimatedText
          text={scene.text}
          emphasis={scene.emphasis}
          tokens={tokens}
          fontSize={72}
          fontWeight={800}
          startDelay={10}
          maxWidth={840}
        />
      </div>
    </Stage>
  );
}
