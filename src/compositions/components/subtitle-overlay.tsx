import { AbsoluteFill, useCurrentFrame } from "remotion";

import type { ReelProps } from "@/compositions/types";
import type { BrandTokens } from "@/compositions/tokens";
import type { ProductionLayout } from "@/production/layout";

export function SubtitleOverlay({
  captions,
  tokens,
  layout,
}: {
  captions: NonNullable<ReelProps["captions"]>;
  tokens: BrandTokens;
  layout: ProductionLayout;
}) {
  const frame = useCurrentFrame();
  if (!captions.enabled) return null;
  const cue = captions.cues.find(
    (candidate) => frame >= candidate.startFrame && frame < candidate.endFrame,
  );
  if (!cue) return null;
  const activeWord = cue.words?.findIndex(
    (word) => frame >= word.startFrame && frame < word.endFrame,
  );

  return (
    <AbsoluteFill
      style={{
        pointerEvents: "none",
        zIndex: 50,
        justifyContent: "flex-end",
        alignItems: "center",
        paddingLeft: layout.safeArea.left,
        paddingRight: layout.safeArea.right,
        paddingBottom: layout.captionBottom,
      }}
    >
      <div
        style={{
          maxWidth: layout.captionMaxWidth,
          borderRadius: Math.max(12, tokens.radius),
          background: "rgba(8, 10, 16, 0.82)",
          color: "#fff",
          padding: "0.42em 0.68em",
          fontSize: Math.round(38 * layout.typeScale),
          fontWeight: 700,
          lineHeight: 1.18,
          textAlign: "center",
          boxShadow: "0 10px 40px rgba(0,0,0,0.28)",
        }}
      >
        {cue.words?.length
          ? cue.words.map((word, index) => (
              <span
                key={`${word.startFrame}-${index}`}
                style={{
                  color: index === activeWord ? tokens.accent : "currentColor",
                }}
              >
                {word.text}
                {index < cue.words!.length - 1 ? " " : ""}
              </span>
            ))
          : cue.text}
      </div>
    </AbsoluteFill>
  );
}
