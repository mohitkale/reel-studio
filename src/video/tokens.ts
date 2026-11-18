import { CORAL_HARBOR_PALETTE } from "@/lib/brand-defaults";
import type { PresenterConfig } from "@/video/presenter-config";

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
  /** Visual theme id (see src/video/themes); drives type, shape, background and motion. */
  themeId?: string;
  /** Look seed, variety level and calm-motion switch (see src/video/variety.ts). */
  lookSeed?: string;
  variety?: "low" | "medium" | "high";
  reduceMotion?: boolean;
  /** An animated presenter over the video (see src/video/presenter-config.ts). */
  presenter?: PresenterConfig;
}

/** Coral Harbor — Airbnb-inspired default for new content. */
export const defaultBrandTokens: BrandTokens = {
  ...CORAL_HARBOR_PALETTE,
  handle: "@yourbrand",
  fontFamily: `"Geist", ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif`,
  radius: 20,
};
