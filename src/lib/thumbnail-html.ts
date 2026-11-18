/**
 * The thumbnail as one HTML page (roadmap A6): big words over a frame from the
 * video, in the theme's colours. Pure and deterministic; the same inputs give
 * the same page, which a browser then turns into a PNG.
 */
export interface ThumbnailPalette {
  background: string;
  backgroundAccent: string;
  foreground: string;
  accent: string;
  accentForeground: string;
}

export const THUMBNAIL_SIZES = {
  landscape: { width: 1280, height: 720 },
  vertical: { width: 1080, height: 1920 },
} as const;
export type ThumbnailSize = keyof typeof THUMBNAIL_SIZES;

export const DEFAULT_PALETTE: ThumbnailPalette = {
  background: "#101216",
  backgroundAccent: "#1d2330",
  foreground: "#ffffff",
  accent: "#ffd23f",
  accentForeground: "#111111",
};

const escapeHtml = (text: string) =>
  text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

/** Only plain CSS colours may reach the page. */
const colour = (value: string, fallback: string) =>
  /^#[0-9a-fA-F]{3,8}$/.test(value) ? value : fallback;

/** Font size that keeps the words inside the frame whatever their length. */
export function thumbnailFontSize(text: string, size: ThumbnailSize): number {
  const { width } = THUMBNAIL_SIZES[size];
  const words = text.split(/\s+/).filter(Boolean);
  const longest = Math.max(...words.map((word) => word.length), 1);
  const base = size === "landscape" ? 150 : 170;
  const byLength = text.length > 28 ? 0.62 : text.length > 16 ? 0.8 : 1;
  const byWord = Math.min(1, (width * 0.84) / (longest * base * 0.62));
  return Math.round(base * byLength * byWord);
}

export function buildThumbnailHtml(input: {
  text: string;
  size: ThumbnailSize;
  palette?: Partial<ThumbnailPalette>;
  fontFamily?: string;
  /** A frame from the video as a data: URL, used as the picture behind the words. */
  frameDataUrl?: string;
}): string {
  const { width, height } = THUMBNAIL_SIZES[input.size];
  const p = { ...DEFAULT_PALETTE, ...input.palette };
  const text = input.text.trim().slice(0, 60) || "New video";
  const font = (input.fontFamily ?? "").replace(/[^A-Za-z0-9 ,'-]/g, "");
  const fontSize = thumbnailFontSize(text, input.size);
  const frame =
    input.frameDataUrl &&
    /^data:image\/(jpeg|png);base64,[A-Za-z0-9+/=]+$/.test(input.frameDataUrl)
      ? `url("${input.frameDataUrl}")`
      : "none";
  return `<!doctype html><html><head><meta charset="utf-8"><style>
*{box-sizing:border-box;margin:0}
html,body{width:${width}px;height:${height}px;overflow:hidden}
body{position:relative;background:linear-gradient(135deg,${colour(p.background, DEFAULT_PALETTE.background)},${colour(p.backgroundAccent, DEFAULT_PALETTE.backgroundAccent)});font-family:${font ? `"${font}",` : ""}system-ui,-apple-system,"Segoe UI",Arial,sans-serif}
.frame{position:absolute;inset:0;background-image:${frame};background-size:cover;background-position:center;filter:saturate(1.1)}
.scrim{position:absolute;inset:0;background:linear-gradient(180deg,rgba(0,0,0,.15) 0%,rgba(0,0,0,.72) 100%)}
.bar{position:absolute;left:${Math.round(width * 0.06)}px;top:${Math.round(height * 0.62)}px;width:${Math.round(width * 0.16)}px;height:${Math.max(10, Math.round(height * 0.012))}px;background:${colour(p.accent, DEFAULT_PALETTE.accent)};border-radius:99px}
.words{position:absolute;left:${Math.round(width * 0.06)}px;right:${Math.round(width * 0.06)}px;top:${Math.round(height * 0.66)}px;bottom:${Math.round(height * 0.06)}px;display:flex;align-items:flex-start;color:#fff;font-weight:900;line-height:1.02;letter-spacing:-0.02em;font-size:${fontSize}px;text-shadow:0 4px 24px rgba(0,0,0,.55);overflow-wrap:anywhere}
</style></head><body><div class="frame"></div><div class="scrim"></div><div class="bar"></div><div class="words">${escapeHtml(text)}</div></body></html>`;
}
