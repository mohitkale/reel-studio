/**
 * Server-safe brand token defaults — plain hex values and generic font stack,
 * no @remotion imports. Used by repositories so API routes don't pull in the
 * Remotion/Google-fonts bundle.
 *
 * Client code (ReelPlayer, templates) should still import defaultBrandTokens
 * from @/compositions/tokens so it gets the loaded Inter font family.
 */
import type { BrandTokens } from "@/compositions/tokens";

export const serverDefaultTokens: BrandTokens = {
  background: "#0D256F",        // Deep blue primary background
  backgroundAccent: "#1A3490",  // Lighter navy for gradient accents
  foreground: "#FFFFFF",
  muted: "#F6ECDB",             // Warm muted tone
  accent: "#FF5900",            // Primary accent orange
  accentSecondary: "#FFA000",   // Secondary accent amber
  accentForeground: "#FFFFFF",
  handle: "@northstarstudio",
  fontFamily: "'DM Sans', 'Segoe UI', Inter, ui-sans-serif, system-ui, -apple-system, sans-serif",
  radius: 20,
};
