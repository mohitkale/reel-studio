import { describe, expect, it } from "vitest";

import { lintStoryboard } from "@/storyboard/lint";
import { planFromStoryboard } from "@/production/storyboard-plan";
import { defaultBrandTokens } from "@/video/tokens";
import {
  applyThemeToTokens,
  autoTheme,
  getTheme,
  THEMES,
  THEME_BY_PRESET,
} from "./index";

const lum = (hex: string) => {
  const c = [1, 3, 5]
    .map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * c[0]! + 0.7152 * c[1]! + 0.0722 * c[2]!;
};
const ratio = (a: string, b: string) => {
  const [x, y] = [lum(a), lum(b)];
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
};
const mix = (a: string, b: string, t: number) =>
  "#" +
  [1, 3, 5]
    .map((i) =>
      Math.round(
        parseInt(a.slice(i, i + 2), 16) * (1 - t) +
          parseInt(b.slice(i, i + 2), 16) * t,
      )
        .toString(16)
        .padStart(2, "0"),
    )
    .join("");

describe("themes", () => {
  it("offers ten themes with unique ids", () => {
    expect(THEMES).toHaveLength(10);
    expect(new Set(THEMES.map((t) => t.id)).size).toBe(10);
  });

  it.each(THEMES.map((t) => [t.id, t] as const))(
    "%s keeps text readable on its own panel",
    (_id, theme) => {
      const p = theme.palette;
      const panel = mix(p.background, p.foreground, 0.09);
      expect(ratio(p.foreground, panel)).toBeGreaterThanOrEqual(7);
      expect(ratio(p.muted, panel)).toBeGreaterThanOrEqual(4.5);
      expect(ratio(p.accent, panel)).toBeGreaterThanOrEqual(4.5);
      expect(ratio(p.accentForeground, p.accent)).toBeGreaterThanOrEqual(4.5);
    },
  );

  it("maps every production look to a theme", () => {
    for (const id of Object.values(THEME_BY_PRESET))
      expect(getTheme(id)).toBeDefined();
  });

  it("chooses automatically and deterministically from the words", () => {
    const text = "Learn to code: a developer guide to the API and the terminal";
    expect(autoTheme(text, "creator-punch").id).toBe("midnight-tech");
    expect(autoTheme(text, "creator-punch").id).toBe(
      autoTheme(text, "creator-punch").id,
    );
    expect(autoTheme("nothing in particular", "data-story").id).toBe(
      "corporate-blue",
    );
  });

  it("puts the palette on tokens, and keeps a brand kit's colours", () => {
    const theme = getTheme("neon")!;
    expect(applyThemeToTokens(defaultBrandTokens, theme).accent).toBe(
      theme.palette.accent,
    );
    const branded = applyThemeToTokens(defaultBrandTokens, theme, {
      keepBrand: true,
    });
    expect(branded.accent).toBe(defaultBrandTokens.accent);
    expect(branded.themeId).toBe("neon");
  });

  it("applies a named theme from a storyboard and repairs an unknown one", () => {
    const base = {
      version: 1,
      title: "T",
      format: "9:16",
      scenes: [
        {
          type: "statement",
          headline: "One idea",
          narration: "One idea, said plainly for everyone.",
        },
      ],
    };
    const named = lintStoryboard({ ...base, theme: "neon" });
    expect(planFromStoryboard(named.storyboard!).themeId).toBe("neon");
    const unknown = lintStoryboard({ ...base, theme: "zebra" });
    expect(unknown.fixes.map((f) => f.rule)).toContain("unknown-theme");
    expect(THEMES.map((t) => t.id)).toContain(
      planFromStoryboard(unknown.storyboard!).themeId,
    );
  });
});
