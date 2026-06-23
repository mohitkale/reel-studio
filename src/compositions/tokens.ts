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
  background: "#0D256F",        // Deep blue primary background
  backgroundAccent: "#1A3490",  // Lighter navy for gradient accents
  foreground: "#FFFFFF",
  muted: "#F6ECDB",             // Warm muted tone
  accent: "#FF5900",            // Primary accent orange
  accentSecondary: "#FFA000",   // Secondary accent amber
  accentForeground: "#FFFFFF",
  handle: "@northstarstudio",
  fontFamily: `${interFontFamily}, ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif`,
  radius: 20,
};
