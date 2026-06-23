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
 * Quote / testimonial: large decorative quotation marks frame a word-by-word
 * text reveal. An optional attribution line fades in below.
 */
export function QuoteCard({ scene, tokens, durationInFrames }: TemplateProps) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const quoteIn = spring({
    frame,
    fps,
    config: { damping: 200, stiffness: 70, mass: 1.0 },
  });

  const attribDelay = 22;
  const attribIn = spring({
    frame: frame - attribDelay,
    fps,
    config: { damping: 200, stiffness: 80 },
  });

  const exit = interpolate(
    frame,
    [durationInFrames - 12, durationInFrames],
    [1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );

  const openQuoteY = (1 - quoteIn) * -48;
  const openQuoteOpacity = quoteIn;

  return (
    <Stage tokens={tokens} background={scene.background} durationInFrames={durationInFrames} contentStyle={{ alignItems: "center", justifyContent: "center" }}>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 48,
          opacity: exit,
          maxWidth: 880,
        }}
      >
        {/* Opening quote mark */}
        <div
          style={{
            alignSelf: "flex-start",
            fontSize: 200,
            lineHeight: 0.7,
            fontWeight: 900,
            color: tokens.accent,
            opacity: openQuoteOpacity * 0.9,
            transform: `translateY(${openQuoteY}px)`,
            fontFamily: "Georgia, serif",
            userSelect: "none",
          }}
        >
          &ldquo;
        </div>

        {/* Quote text */}
        <AnimatedText
          text={scene.text}
          emphasis={scene.emphasis}
          tokens={tokens}
          fontSize={88}
          fontWeight={700}
          startDelay={8}
          lineHeight={1.12}
          align="center"
          maxWidth={860}
        />

        {/* Closing quote + attribution */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "flex-end",
            gap: 16,
            alignSelf: "flex-end",
            opacity: attribIn,
            transform: `translateY(${(1 - attribIn) * 24}px)`,
          }}
        >
          <div
            style={{
              fontSize: 140,
              lineHeight: 0.5,
              fontWeight: 900,
              color: tokens.accentSecondary,
              opacity: 0.85,
              fontFamily: "Georgia, serif",
              userSelect: "none",
            }}
          >
            &rdquo;
          </div>
          {scene.visual ? (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 16,
                color: tokens.muted,
                fontSize: 34,
                fontWeight: 600,
              }}
            >
              <span
                style={{
                  display: "inline-block",
                  width: 40,
                  height: 2,
                  background: `linear-gradient(90deg, ${tokens.accent}, ${tokens.accentSecondary})`,
                  borderRadius: 2,
                }}
              />
              {scene.visual}
            </div>
          ) : null}
        </div>
      </div>
    </Stage>
  );
}
