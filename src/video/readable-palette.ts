import type { BrandTokens } from "./tokens";

function luminance(hex: string): number | undefined {
  const match = /^#([0-9a-f]{6}|[0-9a-f]{3})$/i.exec(hex);
  if (!match) return undefined;
  const value =
    match[1].length === 3
      ? [...match[1]].map((character) => character.repeat(2)).join("")
      : match[1];
  const channels = [0, 2, 4].map((offset) => {
    const channel = parseInt(value.slice(offset, offset + 2), 16) / 255;
    return channel <= 0.04045
      ? channel / 12.92
      : ((channel + 0.055) / 1.055) ** 2.4;
  });
  return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
}

export function colorContrast(
  first: string,
  second: string,
): number | undefined {
  const a = luminance(first),
    b = luminance(second);
  return a === undefined || b === undefined
    ? undefined
    : (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

/** Correct unreadable text paints at compilation; keep saved brand colours and
 * accent graphics intact. This checks solid paints, not contrast over footage.
 */
export function readableMotionPalette(tokens: BrandTokens): BrandTokens {
  const readable = (paint: string, background: string) => {
    const ratio = colorContrast(paint, background);
    if (ratio === undefined || ratio >= 4.5) return paint;
    return (colorContrast("#FFFFFF", background) ?? 0) >
      (colorContrast("#17171C", background) ?? 0)
      ? "#FFFFFF"
      : "#17171C";
  };
  return {
    ...tokens,
    foreground: readable(tokens.foreground, tokens.background),
    muted: readable(tokens.muted, tokens.background),
    accentForeground: readable(tokens.accentForeground, tokens.accent),
  };
}
