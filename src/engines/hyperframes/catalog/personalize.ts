import type { BrandTokens } from "@/compositions/tokens";
import type { ReelScene } from "@/compositions/types";
import {
  getCatalogBlockByTemplateId,
  type HfCatalogBlockId,
  type HfCatalogBlockMeta,
} from "@/engines/hyperframes/catalog/manifest";
import { HF_CATALOG_HTML } from "@/engines/hyperframes/catalog/html";

export interface CatalogPersonalizeContext {
  scene: Pick<ReelScene, "text" | "visual" | "emphasis" | "items" | "chart">;
  tokens: BrandTokens;
}

function replaceAll(
  haystack: string,
  needle: string,
  replacement: string,
): string {
  if (!needle) return haystack;
  return haystack.split(needle).join(replacement);
}

function safeScriptJson(value: unknown): string {
  return JSON.stringify(value)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
}

function brandName(tokens: BrandTokens, fallback: string): string {
  const handle = tokens.handle?.trim();
  if (handle) return handle.replace(/^@/, "");
  return fallback;
}

function handleAt(tokens: BrandTokens, fallback: string): string {
  const handle = tokens.handle?.trim();
  if (!handle) return fallback;
  return handle.startsWith("@") ? handle : `@${handle}`;
}

function domainPill(visual: string | undefined): string {
  const fromVisual = visual?.trim();
  if (fromVisual)
    return fromVisual.replace(/^https?:\/\//, "").replace(/\/$/, "");
  return "";
}

/** Build a WORDS array literal for kinetic slam from scene text. */
function kineticWordsLiteral(text: string): string {
  const words = text
    .trim()
    .split(/\s+/)
    .map((w) => w.replace(/[^\w'’.\-!?%$#]/g, ""))
    .filter(Boolean)
    .slice(0, 28);
  const list = words.length ? words : ["Make", "it", "count."];
  const step = Math.max(0.18, Math.min(0.45, 6 / Math.max(1, list.length)));
  const items = list.map((w, i) => {
    const start = Number((i * step).toFixed(2));
    const end = Number((start + step * 0.9).toFixed(2));
    const safe = safeScriptJson(w);
    return `          { text: ${safe}, start: ${start}, end: ${end} }`;
  });
  return `[\n${items.join(",\n")}\n        ]`;
}

function parseMoneyTarget(visual: string | undefined): number {
  const m = visual?.match(
    /\$?\s*([\d]{1,3}(?:,\d{3})*(?:\.\d+)?|\d+(?:\.\d+)?)\s*([kKmMbB])?/,
  );
  if (!m) throw new Error("Money count requires an explicit numeric visual");
  let n = Number(m[1].replace(/,/g, ""));
  if (!Number.isFinite(n)) {
    throw new Error("Money count visual must contain a finite number");
  }
  const suffix = (m[2] ?? "").toLowerCase();
  if (suffix === "k") n *= 1_000;
  if (suffix === "m") n *= 1_000_000;
  if (suffix === "b") n *= 1_000_000_000;
  return Math.max(1, Math.round(n));
}

function personalizeKineticSlam(
  html: string,
  ctx: CatalogPersonalizeContext,
): string {
  const literal = kineticWordsLiteral(ctx.scene.text);
  return html.replace(/var WORDS = \[[\s\S]*?\];/, `var WORDS = ${literal};`);
}

function personalizeMoneyCount(
  html: string,
  ctx: CatalogPersonalizeContext,
): string {
  const target = parseMoneyTarget(ctx.scene.visual);
  let out = html;
  out = out.replace(/Math\.min\(10000, value\)/g, `Math.min(${target}, value)`);
  out = out.replace(/value:\s*10000/g, `value: ${target}`);
  out = out.replace(/renderAmount\(10000\)/g, `renderAmount(${target})`);
  return out;
}

function personalizeDataChart(
  html: string,
  ctx: CatalogPersonalizeContext,
): string {
  const chart = ctx.scene.chart;
  if (!chart) throw new Error("Data chart requires structured chart data");
  const title =
    ctx.scene.visual?.trim() ||
    ctx.scene.text.trim().slice(0, 64) ||
    "Data overview";
  const revenue = chart.series[0].values;
  const conversion = chart.series[1]?.values ?? chart.series[0].values;
  const maxRevenue = Math.max(25, ...revenue) + 3;
  const maxConversion = Math.max(5, ...conversion) + 0.5;
  let out = replaceAll(
    html,
    "Monthly Revenue vs. Conversion Rate",
    escapeHtmlText(title),
  );
  out = out.replace(
    /const months = \[[^\]]*\];/,
    `const months = ${safeScriptJson(chart.labels)};`,
  );
  out = out.replace(
    /const revenueData = \[[^\]]*\];/,
    `const revenueData = ${safeScriptJson(revenue)};`,
  );
  out = out.replace(
    /const conversionData = \[[^\]]*\];/,
    `const conversionData = ${safeScriptJson(conversion)};`,
  );
  out = out.replace(
    /const maxRevenue = 25;/,
    `const maxRevenue = ${maxRevenue};`,
  );
  out = out.replace(
    /const maxConversion = 5;/,
    `const maxConversion = ${maxConversion};`,
  );
  return out;
}

function personalizeAppShowcase(
  html: string,
  ctx: CatalogPersonalizeContext,
): string {
  const headline =
    ctx.scene.text.trim().slice(0, 48) || "Unleash Full Potential";
  const cta = ctx.scene.visual?.trim() || "START NOW";
  let out = replaceAll(
    html,
    "Unleash Full Potential",
    escapeHtmlText(headline),
  );
  out = replaceAll(out, "START NOW", escapeHtmlText(cta));
  return out;
}

function personalizeLogoOutro(
  html: string,
  ctx: CatalogPersonalizeContext,
): string {
  const tagline =
    ctx.scene.text.trim().slice(0, 80) || "Nothing great is made alone.";
  const pill = domainPill(ctx.scene.visual);
  const name = brandName(ctx.tokens, "yourbrand");
  let out = replaceAll(
    html,
    "Nothing great is made alone.",
    escapeHtmlText(tagline),
  );
  out = replaceAll(out, "figma.com", escapeHtmlText(pill));
  // Title text node used as logo label in the demo.
  out = out.replace(/>Logo Outro</g, `>${escapeHtmlText(name)}<`);
  return out;
}

function personalizeInstagram(
  html: string,
  ctx: CatalogPersonalizeContext,
): string {
  const name = brandName(ctx.tokens, "yourbrand");
  const handle = handleAt(ctx.tokens, "@yourbrand");
  const cta = ctx.scene.visual?.trim() || "Follow";
  let out = replaceAll(html, "@heygen_official", escapeHtmlText(handle));
  out = replaceAll(out, "HeyGen", escapeHtmlText(name));
  // Only replace the primary Follow label in the button (keep "Following").
  out = out.replace(/>Follow</g, `>${escapeHtmlText(cta)}<`);
  return out;
}

function personalizeTiktok(
  html: string,
  ctx: CatalogPersonalizeContext,
): string {
  const name = brandName(ctx.tokens, "yourbrand");
  const handle = handleAt(ctx.tokens, "@yourbrand");
  const cta = ctx.scene.visual?.trim() || "Follow";
  let out = replaceAll(html, "@heygen.com", escapeHtmlText(handle));
  out = replaceAll(out, "HeyGen", escapeHtmlText(name));
  out = out.replace(/>Follow</g, `>${escapeHtmlText(cta)}<`);
  return out;
}

function personalizeYtLowerThird(
  html: string,
  ctx: CatalogPersonalizeContext,
): string {
  const name = brandName(ctx.tokens, "yourbrand");
  const cta = ctx.scene.visual?.trim() || "Subscribe";
  let out = replaceAll(html, "HeyGen", escapeHtmlText(name));
  out = out.replace(/>Subscribe</g, `>${escapeHtmlText(cta)}<`);
  return out;
}

function escapeHtmlText(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

const PERSONALIZERS: Record<
  HfCatalogBlockId,
  (html: string, ctx: CatalogPersonalizeContext) => string
> = {
  "caption-kinetic-slam": personalizeKineticSlam,
  "apple-money-count": personalizeMoneyCount,
  "data-chart": personalizeDataChart,
  "app-showcase": personalizeAppShowcase,
  "logo-outro": personalizeLogoOutro,
  "instagram-follow": personalizeInstagram,
  "tiktok-follow": personalizeTiktok,
  "yt-lower-third": personalizeYtLowerThird,
};

/** Return personalized catalog HTML for a block id. */
export function personalizeCatalogHtml(
  blockId: HfCatalogBlockId | string,
  ctx: CatalogPersonalizeContext,
): string {
  const raw = HF_CATALOG_HTML[blockId];
  if (!raw) {
    throw new Error(`Unknown HyperFrames catalog block: ${blockId}`);
  }
  const fn = PERSONALIZERS[blockId as HfCatalogBlockId];
  return fn ? fn(raw, ctx) : raw;
}

export function personalizeCatalogBlock(
  meta: HfCatalogBlockMeta,
  ctx: CatalogPersonalizeContext,
): string {
  return personalizeCatalogHtml(meta.id, ctx);
}

/**
 * Extract style + body markup + scripts from a full catalog HTML document so
 * it can be inlined into a host composition for srcDoc preview.
 */
export function extractCatalogInlineParts(fullHtml: string): {
  styles: string;
  body: string;
  scripts: string;
  gsapNeeded: boolean;
} {
  const styles = [...fullHtml.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/gi)]
    .map((m) => m[1])
    .join("\n");
  const scripts = [
    ...fullHtml.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi),
  ]
    .map((m) => m[1])
    .join("\n;\n");
  const bodyMatch = fullHtml.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  let body = bodyMatch?.[1] ?? fullHtml;
  // Drop nested script tags from body — we re-append them once after markup.
  body = body.replace(/<script\b[\s\S]*?<\/script>/gi, "");
  const gsapNeeded = /gsap@|gsap\.min\.js|gsap\.timeline/i.test(fullHtml);
  return { styles, body, scripts, gsapNeeded };
}

export function resolveCatalogMetaForTemplate(
  templateId: string,
): HfCatalogBlockMeta | undefined {
  return getCatalogBlockByTemplateId(templateId);
}
