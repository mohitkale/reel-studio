/**
 * Render side of themes (roadmap V5): the CSS variables, the root attributes
 * and the stylesheet that make a theme's type, shape, background treatment and
 * motion visible. Palette and body font travel on the brand tokens.
 */
import type { BundledFont, Theme } from "@/video/themes/types";

const FALLBACK: Record<BundledFont, string> = {
  Geist: "ui-sans-serif, system-ui, sans-serif",
  Inter: "ui-sans-serif, system-ui, sans-serif",
  "EB Garamond": "Georgia, serif",
  "Archivo Black": "Impact, sans-serif",
  "JetBrains Mono": "ui-monospace, monospace",
};

/** Custom properties for the composition root. */
export function themeRootStyle(theme: Theme): string {
  // Single quotes: the value sits inside a style="..." attribute.
  const heading = `'${theme.fonts.heading}', ${FALLBACK[theme.fonts.heading]}`;
  return [
    `--theme-heading-font:${heading}`,
    `--theme-weight:${theme.type.weight}`,
    `--theme-tracking:${theme.type.tracking}em`,
    `--theme-case:${theme.type.uppercase ? "uppercase" : "none"}`,
    `--theme-radius:${theme.shape.radius}px`,
    `--theme-stroke:${theme.shape.stroke}px`,
  ].join(";");
}

/** Attributes the stylesheet and the motion script read. */
export function themeRootAttributes(theme: Theme): string {
  return `data-theme="${theme.id}" data-theme-bg="${theme.background}" data-theme-motion="${theme.motion}"`;
}

const HEADINGS = [
  ".fx-stack .fx-line-inner",
  ".fx-list-title",
  ".fx-chart-title",
  ".fx-money-num",
  ".sc-define-term",
  ".sc-card-label",
  ".sc-moment-label",
  ".sc-node-label",
]
  .map((selector) => `#root[data-theme] ${selector}`)
  .join(",\n  ");

export const THEME_STYLES = `
  ${HEADINGS} {
    font-family: var(--theme-heading-font) !important;
    font-weight: var(--theme-weight) !important;
    letter-spacing: var(--theme-tracking) !important;
    text-transform: var(--theme-case) !important;
  }
  #root[data-theme] .fx-panelled .fx-dialogue {
    border-radius: var(--theme-radius);
    border: var(--theme-stroke) solid color-mix(in srgb, var(--fx-c, #fff) 55%, transparent);
  }
  #root[data-theme] .sc-card, #root[data-theme] .sc-node { border-radius: calc(var(--theme-radius) * 0.7); border-width: var(--theme-stroke); }
  #root[data-theme] .fx-check-num { color: var(--brand-accent-text, var(--fx-ink)) !important; }
  #root[data-theme] .fx-cta-btn, #root[data-theme] .fx-social-btn, #root[data-theme] .fx-yt-btn { color: var(--brand-accent-foreground, #0b0f19); }
  #root[data-theme] .fx-cta-btn, #root[data-theme] .fx-pill { border-radius: calc(var(--theme-radius) * 0.7); }

  #root[data-theme]:not([data-theme-bg="cinema"]) .fx-letterbox { display: none; }
  #root[data-theme] .fx-panelled .fx-dialogue { background: color-mix(in srgb, var(--fx-ink, #fff) 9%, var(--fx-a, transparent)); }
  #root[data-theme] .fx-stage::after { content: ""; position: absolute; inset: 0; z-index: 2; pointer-events: none; }
  #root[data-theme-bg="flat"] .fx-grain,
  #root[data-theme-bg="flat"] .fx-deep-orb, #root[data-theme-bg="flat"] .fx-studio-beam,
  #root[data-theme-bg="flat"] .fx-floor-glow, #root[data-theme-bg="flat"] .fx-slash,
  #root[data-theme-bg="flat"] .fx-paper-corner, #root[data-theme-bg="flat"] .fx-void-panel,
  #root[data-theme-bg="flat"] .fx-bill-shine, #root[data-theme-bg="flat"] .fx-min-ring,
  #root[data-theme-bg="flat"] .fx-social-blob { display: none; }
  #root[data-theme-bg="grid"] .fx-stage::after {
    background-image:
      linear-gradient(color-mix(in srgb, var(--fx-c) 14%, transparent) 1px, transparent 1px),
      linear-gradient(90deg, color-mix(in srgb, var(--fx-c) 14%, transparent) 1px, transparent 1px);
    background-size: calc(var(--frame-h) * 0.04) calc(var(--frame-h) * 0.04);
  }
  #root[data-theme-bg="paper"] .fx-stage::after {
    background: radial-gradient(ellipse at 50% 45%, transparent 55%, color-mix(in srgb, var(--fx-ink) 14%, transparent) 100%);
  }
  #root[data-theme-bg="glow"] .fx-stage::after {
    background:
      radial-gradient(circle at 12% 8%, color-mix(in srgb, var(--fx-c) 38%, transparent), transparent 42%),
      radial-gradient(circle at 92% 90%, color-mix(in srgb, var(--fx-glow) 34%, transparent), transparent 44%);
  }
  #root[data-theme-bg="blocks"] .fx-stage::after {
    background:
      linear-gradient(135deg, var(--fx-c) 0 11%, transparent 11%),
      linear-gradient(315deg, var(--fx-glow) 0 7%, transparent 7%);
  }
  #root[data-theme-bg="blobs"] .fx-stage::after {
    background:
      radial-gradient(circle at 0% 0%, color-mix(in srgb, var(--fx-glow) 30%, transparent) 0 22%, transparent 23%),
      radial-gradient(circle at 100% 100%, color-mix(in srgb, var(--fx-c) 26%, transparent) 0 26%, transparent 27%);
  }
  #root[data-theme-bg="cinema"] .fx-stage::after {
    background:
      linear-gradient(#000 0 4.5%, transparent 4.5% 95.5%, #000 95.5%),
      radial-gradient(ellipse at 50% 50%, transparent 52%, rgba(0,0,0,.42) 100%);
  }
`;
