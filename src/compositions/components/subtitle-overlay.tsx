import { AbsoluteFill, useCurrentFrame } from "remotion";

import type { ReelProps } from "@/compositions/types";
import type { BrandTokens } from "@/compositions/tokens";
import type { ProductionLayout } from "@/production/layout";
import {
  resolveCaptionRenderStyle,
  splitCaptionText,
  splitCaptionWords,
} from "@/lib/caption-render";

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
  const resolved = resolveCaptionRenderStyle({
    style: captions.style,
    tokens,
    layout,
    engine: "remotion",
  });
  const { activeWordColor, ...innerStyle } = resolved.inner;
  const wordsPerLine =
    resolved.style.presetId === "legacy"
      ? Number.MAX_SAFE_INTEGER
      : resolved.style.maxWordsPerLine;
  const wordLines = cue.words?.length
    ? splitCaptionWords(cue.words, wordsPerLine)
    : undefined;
  const textLines = wordLines
    ? undefined
    : splitCaptionText(cue.text, wordsPerLine);
  const lineCount = wordLines?.length ?? textLines?.length ?? 1;
  const lineScale = Math.max(
    0.65,
    Math.min(1, resolved.style.maxLines / lineCount),
  );

  function highlighted(index: number): boolean {
    if (resolved.style.highlightMode === "phrase") return true;
    if (activeWord === undefined || activeWord < 0) return false;
    if (resolved.style.highlightMode === "karaoke") return index <= activeWord;
    return resolved.style.highlightMode === "word" && index === activeWord;
  }

  return (
    <AbsoluteFill
      data-caption-style-version={resolved.style.version}
      data-caption-style={resolved.style.presetId}
      style={{
        pointerEvents: "none",
        zIndex: 50,
        ...resolved.outer,
      }}
    >
      <div
        dir="auto"
        style={{
          ...innerStyle,
          fontSize: Math.round(innerStyle.fontSize * lineScale),
          overflowWrap: "anywhere",
        }}
      >
        {wordLines
          ? wordLines.map((line, lineIndex) => {
              const priorWords = wordLines
                .slice(0, lineIndex)
                .reduce((sum, current) => sum + current.length, 0);
              return (
                <div key={`${lineIndex}-${line[0]?.startFrame}`}>
                  {line.map((word, wordIndex) => {
                    const index = priorWords + wordIndex;
                    return (
                      <span
                        key={`${word.startFrame}-${index}`}
                        style={{
                          color: highlighted(index)
                            ? activeWordColor
                            : "currentColor",
                        }}
                      >
                        {word.text}
                        {wordIndex < line.length - 1 ? " " : ""}
                      </span>
                    );
                  })}
                </div>
              );
            })
          : textLines?.map((line) => (
              <div
                key={line}
                style={{
                  color:
                    resolved.style.highlightMode === "phrase"
                      ? activeWordColor
                      : "currentColor",
                }}
              >
                {line}
              </div>
            ))}
      </div>
    </AbsoluteFill>
  );
}
