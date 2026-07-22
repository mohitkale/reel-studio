/**
 * Server-safe brand token defaults — plain hex values and generic font stack,
 * no @remotion imports. Used by repositories so API routes don't pull in the
 * Remotion/Google-fonts bundle.
 *
 * Client code (ReelPlayer, templates) should still import defaultBrandTokens
 * from @/compositions/tokens so it gets the loaded Inter font family.
 *
 * Coral Harbor — Airbnb-inspired palette tuned for vertical video readability.
 */

export const CORAL_HARBOR_NAME = "Coral Harbor";

export const CORAL_HARBOR_PALETTE = {
  background: "#0B0B0F",
  backgroundAccent: "#16161C",
  foreground: "#FFFFFF",
  /** Lighter muted for readable labels on dark canvases (WCAG-friendly). */
  muted: "#C4C4C8",
  accent: "#FF5A5F",
  accentSecondary: "#2BB5A8",
  accentForeground: "#FFFFFF",
} as const;

/** Shape mirrors BrandTokens in compositions/tokens.ts (kept free of that import). */
export const serverDefaultTokens = {
  ...CORAL_HARBOR_PALETTE,
  handle: "@yourbrand",
  fontFamily:
    "'DM Sans', 'Segoe UI', Inter, ui-sans-serif, system-ui, -apple-system, sans-serif",
  radius: 20,
};
