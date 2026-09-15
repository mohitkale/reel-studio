import type { BrandTokens } from "@/compositions/tokens";
import type { ProductionLayout } from "@/production/layout";
import {
  LEGACY_CAPTION_STYLE,
  type CaptionStyleSnapshot,
} from "@/lib/caption-style";

export function colorWithOpacity(hex: string, opacity: number): string {
  const value = hex.slice(1);
  return `rgba(${Number.parseInt(value.slice(0, 2), 16)}, ${Number.parseInt(value.slice(2, 4), 16)}, ${Number.parseInt(value.slice(4, 6), 16)}, ${opacity})`;
}

export function captionFontStack(
  family: CaptionStyleSnapshot["fontFamily"],
  brandFont: string,
): string {
  switch (family) {
    case "brand":
      return brandFont;
    case "serif":
      return 'Georgia, "Times New Roman", serif';
    case "mono":
      return '"Geist Mono", ui-monospace, SFMono-Regular, Menlo, monospace';
    case "display":
      return '"Geist", Impact, Haettenschweiler, sans-serif';
    default:
      return '"Geist", system-ui, sans-serif';
  }
}

export function resolveCaptionRenderStyle(input: {
  style?: CaptionStyleSnapshot;
  tokens: BrandTokens;
  layout: ProductionLayout;
}) {
  const style = input.style ?? LEGACY_CAPTION_STYLE;
  const { layout, tokens } = input;
  const offsets = style.safeAreaOffsets[layout.orientation];
  const scale = layout.typeScale;
  const textAlign = style.alignment;
  const alignItems =
    textAlign === "left"
      ? ("flex-start" as const)
      : textAlign === "right"
        ? ("flex-end" as const)
        : ("center" as const);
  const justifyContent =
    style.position === "top"
      ? ("flex-start" as const)
      : style.position === "center"
        ? ("center" as const)
        : ("flex-end" as const);
  const fontSize = Math.round(style.fontSize * scale);

  return {
    style,
    outer: {
      justifyContent,
      alignItems,
      paddingTop: layout.safeArea.top + Math.round(layout.height * offsets.top),
      paddingRight:
        layout.safeArea.right + Math.round(layout.width * offsets.right),
      paddingBottom:
        (style.position === "bottom"
          ? layout.captionBottom
          : layout.safeArea.bottom) +
        Math.round(layout.height * offsets.bottom),
      paddingLeft:
        layout.safeArea.left + Math.round(layout.width * offsets.left),
    },
    inner: {
      maxWidth: layout.captionMaxWidth,
      padding: `${Math.round(style.paddingY * scale)}px ${Math.round(style.paddingX * scale)}px`,
      borderRadius:
        style.presetId === "legacy"
          ? Math.max(12, tokens.radius)
          : Math.round(style.radius * scale),
      background: colorWithOpacity(
        style.backgroundColor,
        style.backgroundOpacity,
      ),
      color: style.textColor,
      activeWordColor:
        style.presetId === "legacy" ? tokens.accent : style.activeWordColor,
      fontFamily: captionFontStack(style.fontFamily, tokens.fontFamily),
      fontSize,
      fontWeight: style.fontWeight,
      lineHeight: style.lineHeight,
      letterSpacing: `${style.letterSpacing}em`,
      textAlign,
      textShadow: `${Math.round(style.shadowOffsetX * scale)}px ${Math.round(style.shadowOffsetY * scale)}px ${Math.round(style.shadowBlur * scale)}px ${colorWithOpacity(style.shadowColor, style.shadowOpacity)}`,
      WebkitTextStroke:
        style.outlineWidth > 0
          ? `${style.outlineWidth * scale}px ${style.outlineColor}`
          : undefined,
    },
  };
}

export function splitCaptionWords<T>(
  words: readonly T[],
  maxWordsPerLine: number,
): T[][] {
  const lines: T[][] = [];
  for (let index = 0; index < words.length; index += maxWordsPerLine) {
    lines.push(words.slice(index, index + maxWordsPerLine));
  }
  return lines;
}

export function splitCaptionText(
  text: string,
  maxWordsPerLine: number,
): string[] {
  return splitCaptionWords(text.trim().split(/\s+/u), maxWordsPerLine).map(
    (line) => line.join(" "),
  );
}
