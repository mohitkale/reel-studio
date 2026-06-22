import { interFontFamily } from "./fonts";

/**
 * Design tokens for the video templates. Concrete hex values (canvas and WebGL
 * need real colors, not CSS vars). These form re-skinnable "brand kits" in M6 -
 * a brand kit is just a different BrandTokens object.
 */
export interface BrandTokens {
  background: string;
  backgroundAccent: string;
  foreground: string;
  muted: string;
  accent: string;
  accentSecondary: string;
  accentForeground: string;
  handle: string;
  fontFamily: string;
  radius: number;
}

export const defaultBrandTokens: BrandTokens = {
  background: "#08070d",
  backgroundAccent: "#1a0f33",
  foreground: "#ffffff",
  muted: "#b7b3c7",
  accent: "#8b5cf6",
  accentSecondary: "#22d3ee",
  accentForeground: "#0b0717",
  handle: "@reel.studio",
  fontFamily: `${interFontFamily}, ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif`,
  radius: 28,
};
