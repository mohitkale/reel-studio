const SANS_FAMILIES = [
  "DM Sans",
  "Inter",
  "Poppins",
  "Libre Franklin",
  "Roboto",
  "Montserrat",
  "Open Sans",
  "Arial",
  "Helvetica",
  "Anton",
] as const;

const SERIF_FAMILIES = [
  "Instrument Serif",
  "EB Garamond",
  "Libre Baskerville",
  "Playfair Display",
  "Georgia",
] as const;

const MONO_FAMILIES = [
  "JetBrains Mono",
  "SFMono-Regular",
  "SF Mono",
  "Menlo",
  "Monaco",
  "Consolas",
  "Courier New",
] as const;

export const HYPERFRAMES_RENDER_FONT_FILES = {
  sans: "geist-latin-wght-normal.woff2",
  serif: "geist-latin-wght-normal.woff2",
  mono: "geist-mono-latin-wght-normal.woff2",
} as const;

function fontFaceRules(
  families: readonly string[],
  filename: string,
  runtimeUrl: string,
): string {
  return families
    .map(
      (family) =>
        `@font-face{font-family:${JSON.stringify(family)};src:url(${JSON.stringify(`${runtimeUrl}/${filename}`)}) format("woff2");font-style:normal;font-weight:100 900;font-display:block;}`,
    )
    .join("\n");
}

export function hyperframesLocalFontStyles(runtimeUrl = "/_runtime"): string {
  return [
    fontFaceRules(
      SANS_FAMILIES,
      HYPERFRAMES_RENDER_FONT_FILES.sans,
      runtimeUrl,
    ),
    fontFaceRules(
      SERIF_FAMILIES,
      HYPERFRAMES_RENDER_FONT_FILES.serif,
      runtimeUrl,
    ),
    fontFaceRules(
      MONO_FAMILIES,
      HYPERFRAMES_RENDER_FONT_FILES.mono,
      runtimeUrl,
    ),
  ].join("\n");
}

/** Remove remote font stylesheets and bind every shipped family to local WOFF2. */
export function localizeHyperframesRenderFonts(
  html: string,
  runtimeUrl = "/_runtime",
): string {
  const withoutRemoteFonts = html
    .replace(
      /<link\b[^>]*\bhref=["']https:\/\/fonts\.(?:googleapis|gstatic)\.com[^>]*>/gi,
      "",
    )
    .replace(
      /@import\s+url\(\s*["']?https:\/\/fonts\.googleapis\.com[^)]*\)\s*;?/gi,
      "",
    );
  const localStyle = `<style data-reel-local-fonts>${hyperframesLocalFontStyles(runtimeUrl)}</style>`;
  if (/<\/head>/i.test(withoutRemoteFonts)) {
    return withoutRemoteFonts.replace(/<\/head>/i, `${localStyle}</head>`);
  }
  return `${localStyle}${withoutRemoteFonts}`;
}
