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
  background: "#08070d",
  backgroundAccent: "#1a0f33",
  foreground: "#ffffff",
  muted: "#b7b3c7",
  accent: "#8b5cf6",
  accentSecondary: "#22d3ee",
  accentForeground: "#0b0717",
  handle: "@reel.studio",
  fontFamily: "Inter, ui-sans-serif, system-ui, -apple-system, sans-serif",
  radius: 28,
};
