import { expect, it } from "vitest";
import { defaultBrandTokens } from "./tokens";
import { colorContrast, readableMotionPalette } from "./readable-palette";

it("keeps accessible dark and light brand palettes and repairs unreadable text pairs", () => {
  for (const background of ["#0B0B0F", "#FAF7F1", "#FF5A5F"]) {
    const original = {
      ...defaultBrandTokens,
      background,
      foreground: background,
      muted: background,
    };
    const result = readableMotionPalette(original);
    expect(colorContrast(result.foreground, background)).toBeGreaterThanOrEqual(
      4.5,
    );
    expect(colorContrast(result.muted, background)).toBeGreaterThanOrEqual(4.5);
    expect(
      colorContrast(result.accentForeground, result.accent),
    ).toBeGreaterThanOrEqual(4.5);
    expect(result.background).toBe(original.background);
    expect(result.accent).toBe(original.accent);
    expect(original.foreground).toBe(background);
    expect(readableMotionPalette(result)).toEqual(result);
  }
  const accessible = { ...defaultBrandTokens, accentForeground: "#17171C" };
  expect(readableMotionPalette(accessible)).toEqual(accessible);
});

it("handles shorthand colours and leaves unsupported paints alone", () => {
  expect(colorContrast("#fff", "#000")).toBe(21);
  expect(colorContrast("invalid", "#fff")).toBeUndefined();
});
