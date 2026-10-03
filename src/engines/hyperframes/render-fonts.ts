import manifest from "../../../public/reel-runtime/manifest.json";

export const HYPERFRAMES_RENDER_FONT_FILES = {
  sans: "geist-latin-wght-normal.woff2",
  serif: "eb-garamond-latin-400-normal.woff2",
  mono: "geist-mono-latin-wght-normal.woff2",
} as const;

export function hyperframesLocalFontStyles(runtimeUrl = "/_runtime"): string {
  return manifest.fontCss.replaceAll("__RUNTIME__", runtimeUrl);
}

/** Brand font choices are restricted to the frozen runtime; unknown OS fonts
 * fall back consistently instead of changing between editor and render host. */
export function hyperframesBrandFont(value: string): string {
  const candidates = value
    .split(",")
    .map((family) => family.trim().replace(/["']/g, ""));
  const aliases: Record<string, string> = {
    "DM Sans": "Inter",
    Poppins: "Inter",
    Roboto: "Inter",
    Georgia: "EB Garamond",
    "Instrument Serif": "EB Garamond",
    Anton: "Archivo Black",
    Impact: "Archivo Black",
  };
  const supported = new Set([
    "Geist",
    "Geist Mono",
    "Inter",
    "EB Garamond",
    "Archivo Black",
    "JetBrains Mono",
  ]);
  for (const candidate of candidates) {
    const family = aliases[candidate] ?? candidate;
    if (supported.has(family)) return family;
  }
  return "Geist";
}

/** Use genuine bundled families and subsets on both preview and export paths. */
export function localizeHyperframesRenderFonts(
  html: string,
  runtimeUrl = "/_runtime",
): string {
  const normalizeCss = (css: string) =>
    css.replace(
      /(font-family\s*:)([^;}]+)/gi,
      (_, property: string, families: string) =>
        property +
        families
          .replace(
            /Instrument Serif|Libre Baskerville|Playfair Display|Georgia/g,
            "EB Garamond",
          )
          .replace(
            /DM Sans|Poppins|Libre Franklin|Roboto|Montserrat|Open Sans|Segoe UI/g,
            "Inter",
          )
          .replace(/SFMono-Regular|Menlo|Monaco|Consolas/g, "Geist Mono")
          .replace(/Anton|Impact/g, "Archivo Black"),
    );
  const withoutRemoteFonts = html
    // Restrict normalization to CSS: authored copy and script names stay exact.
    .replace(
      /(<style\b[^>]*>)([\s\S]*?)(<\/style>)/gi,
      (_, open: string, css: string, close: string) =>
        open + normalizeCss(css) + close,
    )
    .replace(
      /\bstyle=(["'])([\s\S]*?)\1/gi,
      (_, quote: string, css: string) =>
        `style=${quote}${normalizeCss(css)}${quote}`,
    )
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
