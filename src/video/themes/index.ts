/**
 * The theme registry. Adding a theme is one file plus one line here.
 */
import type { ProductionPresetId } from "@/production/presets";
import type { BrandTokens } from "@/video/tokens";
import { boldPop } from "./bold-pop";
import { cinematic } from "./cinematic";
import { cleanMinimal } from "./clean-minimal";
import { corporateBlue } from "./corporate-blue";
import { editorialPaper } from "./editorial-paper";
import { midnightTech } from "./midnight-tech";
import { monoBrutalist } from "./mono-brutalist";
import { neon } from "./neon";
import { playfulPastel } from "./playful-pastel";
import { warmDocumentary } from "./warm-documentary";
import type { Theme } from "./types";

export type { Theme } from "./types";

export const THEMES: readonly Theme[] = [
  boldPop,
  cleanMinimal,
  midnightTech,
  editorialPaper,
  neon,
  warmDocumentary,
  corporateBlue,
  playfulPastel,
  monoBrutalist,
  cinematic,
];

export const THEME_IDS = THEMES.map((theme) => theme.id);

export function getTheme(id: string | undefined | null): Theme | undefined {
  return THEMES.find((theme) => theme.id === id);
}

/** Each existing production look keeps a matching theme. */
export const THEME_BY_PRESET: Readonly<Record<ProductionPresetId, string>> = {
  "product-launch": "clean-minimal",
  "editorial-explainer": "editorial-paper",
  "creator-punch": "bold-pop",
  "data-story": "corporate-blue",
  "developer-demo": "midnight-tech",
  "cinematic-brand": "cinematic",
};

/**
 * Pick a theme from the words of a storyboard. Deterministic: the theme with
 * the most keyword hits wins, ties go to the earlier theme in the list, and no
 * hits fall back to the theme of the production look.
 */
export function autoTheme(
  text: string,
  fallbackPreset: ProductionPresetId,
): Theme {
  const haystack = ` ${text.toLowerCase().replace(/[^a-z0-9 ]+/g, " ")} `;
  let best: { theme: Theme; hits: number } | undefined;
  for (const theme of THEMES) {
    let hits = 0;
    for (const keyword of theme.keywords) {
      if (haystack.includes(` ${keyword} `)) hits += 1;
    }
    if (hits > 0 && (!best || hits > best.hits)) best = { theme, hits };
  }
  // One stray keyword is not enough to override the production look's theme.
  return best && best.hits >= 2
    ? best.theme
    : getTheme(THEME_BY_PRESET[fallbackPreset])!;
}

/**
 * Put a theme's palette, body font and corner radius on brand tokens. With a
 * brand kit the kit's own values stay and only the theme id is recorded, so the
 * type, shape, background and motion still follow the theme.
 */
export function applyThemeToTokens(
  tokens: BrandTokens,
  theme: Theme,
  options: { keepBrand?: boolean } = {},
): BrandTokens {
  if (options.keepBrand) return { ...tokens, themeId: theme.id };
  const { palette } = theme;
  return {
    ...tokens,
    background: palette.background,
    backgroundAccent: palette.backgroundAccent,
    foreground: palette.foreground,
    muted: palette.muted,
    accent: palette.accent,
    accentSecondary: palette.accentSecondary,
    accentForeground: palette.accentForeground,
    fontFamily: `"${theme.fonts.body}", ui-sans-serif, system-ui, sans-serif`,
    radius: theme.shape.radius,
    themeId: theme.id,
  };
}
