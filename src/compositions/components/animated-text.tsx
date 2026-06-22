"use client";

import { spring, useCurrentFrame, useVideoConfig } from "remotion";

import type { BrandTokens } from "../tokens";

const clean = (w: string) => w.toLowerCase().replace(/[^a-z0-9]/g, "");

interface AnimatedTextProps {
  text: string;
  emphasis: string[];
  tokens: BrandTokens;
  fontSize: number;
  fontWeight?: number;
  startDelay?: number;
  stagger?: number;
  lineHeight?: number;
  align?: "left" | "center";
  maxWidth?: number;
}

/**
 * Word-by-word masked reveal: each word slides up from behind a clip mask with a
 * spring and a slight blur-in. Emphasized words get a marker-highlight that
 * wipes in behind them. Used for headlines and captions.
 */
export function AnimatedText({
  text,
  emphasis,
  tokens,
  fontSize,
  fontWeight = 800,
  startDelay = 0,
  stagger = 2.5,
  lineHeight = 1.04,
  align = "center",
  maxWidth,
}: AnimatedTextProps) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const words = text.split(/\s+/).filter(Boolean);
  const emphasisTokens = new Set(
    emphasis.flatMap((p) => p.split(/\s+/).map(clean)).filter(Boolean),
  );

  return (
    <div
      style={{
        display: "flex",
        flexWrap: "wrap",
        justifyContent: align === "center" ? "center" : "flex-start",
        alignItems: "flex-end",
        columnGap: "0.26em",
        rowGap: "0.12em",
        fontSize,
        fontWeight,
        lineHeight,
        letterSpacing: "-0.02em",
        textAlign: align,
        color: tokens.foreground,
        maxWidth,
      }}
    >
      {words.map((word, i) => {
        const delay = startDelay + i * stagger;
        const enter = spring({
          frame: frame - delay,
          fps,
          config: { damping: 200, stiffness: 95, mass: 0.7 },
        });
        const y = (1 - enter) * fontSize * 0.95;
        const blur = (1 - enter) * 7;
        const emphasized = emphasisTokens.has(clean(word));
        const marker = emphasized
          ? spring({
              frame: frame - delay - 7,
              fps,
              config: { damping: 200, stiffness: 120, mass: 0.6 },
            })
          : 0;

        return (
          <span
            key={i}
            style={{
              display: "inline-block",
              overflow: "hidden",
              paddingBottom: "0.14em",
              marginBottom: "-0.14em",
            }}
          >
            <span
              style={{
                display: "inline-block",
                transform: `translateY(${y}px)`,
                opacity: enter,
                filter: blur > 0.2 ? `blur(${blur}px)` : "none",
              }}
            >
              <span style={{ position: "relative", display: "inline-block" }}>
                {emphasized ? (
                  <span
                    aria-hidden
                    style={{
                      position: "absolute",
                      left: "-0.14em",
                      right: "-0.14em",
                      top: "0.1em",
                      bottom: "0.12em",
                      background: `linear-gradient(120deg, ${tokens.accent}, ${tokens.accentSecondary})`,
                      borderRadius: "0.18em",
                      transformOrigin: "left center",
                      transform: `scaleX(${marker})`,
                      zIndex: 0,
                    }}
                  />
                ) : null}
                <span
                  style={{
                    position: "relative",
                    zIndex: 1,
                    color: emphasized && marker > 0.6
                      ? tokens.accentForeground
                      : tokens.foreground,
                    transition: "color 0.1s",
                  }}
                >
                  {word}
                </span>
              </span>
            </span>
          </span>
        );
      })}
    </div>
  );
}
