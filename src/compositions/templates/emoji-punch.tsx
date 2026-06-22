"use client";

import {
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";

import type { TemplateProps } from "../types";
import { Stage } from "../components/stage";
import { AnimatedText } from "../components/animated-text";

/**
 * Emoji punch: a giant emoji slams in with a spring bounce, shockwave rings
 * pulse out from it, then the one-liner text reveals below. Maximum impact.
 */
export function EmojiPunch({ scene, tokens, durationInFrames }: TemplateProps) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const emoji = scene.visual || "✨";

  const emojiIn = spring({
    frame,
    fps,
    config: { damping: 100, stiffness: 260, mass: 0.5 },
  });
  const emojiScale = interpolate(emojiIn, [0, 1], [0.0, 1]);
  const emojiRotate = interpolate(emojiIn, [0, 1], [-15, 0]);

  // Shockwave ring: expands outward then fades.
  const wave1 = spring({
    frame: frame - 2,
    fps,
    config: { damping: 200, stiffness: 60, mass: 1.2 },
  });
  const wave2 = spring({
    frame: frame - 8,
    fps,
    config: { damping: 200, stiffness: 60, mass: 1.2 },
  });

  const wobble = Math.sin(frame / 22) * (frame < 20 ? 8 : 2);

  const exit = interpolate(
    frame,
    [durationInFrames - 12, durationInFrames],
    [1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );

  return (
    <Stage tokens={tokens} contentStyle={{ alignItems: "center", justifyContent: "center" }}>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 80,
          opacity: exit,
        }}
      >
        {/* Emoji + rings */}
        <div style={{ position: "relative", width: 360, height: 360, display: "flex", alignItems: "center", justifyContent: "center" }}>
          {/* Shockwave rings */}
          {[wave1, wave2].map((wave, i) => (
            <div
              key={i}
              style={{
                position: "absolute",
                inset: 0,
                borderRadius: "50%",
                border: `${3 - i}px solid ${i === 0 ? tokens.accent : tokens.accentSecondary}`,
                transform: `scale(${1 + wave * (1.6 + i * 0.8)})`,
                opacity: Math.max(0, (1 - wave) * 0.7),
              }}
            />
          ))}

          {/* Glow behind emoji */}
          <div
            style={{
              position: "absolute",
              inset: "10%",
              borderRadius: "50%",
              background: `radial-gradient(circle, ${tokens.accent}55 0%, transparent 70%)`,
              filter: "blur(30px)",
              opacity: 0.5 + Math.sin(frame / 20) * 0.3,
            }}
          />

          {/* The emoji */}
          <div
            style={{
              fontSize: 240,
              lineHeight: 1,
              transform: `scale(${emojiScale}) rotate(${emojiRotate + wobble}deg)`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              userSelect: "none",
            }}
          >
            {emoji}
          </div>
        </div>

        {/* Text */}
        <AnimatedText
          text={scene.text}
          emphasis={scene.emphasis}
          tokens={tokens}
          fontSize={82}
          fontWeight={800}
          startDelay={12}
          maxWidth={840}
        />
      </div>
    </Stage>
  );
}
