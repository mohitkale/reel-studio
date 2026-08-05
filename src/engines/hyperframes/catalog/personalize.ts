import type { BrandTokens } from "@/compositions/tokens";
import type { ReelScene } from "@/compositions/types";
import {
  getCatalogBlockById,
  type HfCatalogBlockId,
  type HfCatalogBlockMeta,
} from "@/engines/hyperframes/catalog/manifest";
import { HF_CATALOG_HTML } from "@/engines/hyperframes/catalog/html";

export interface CatalogPersonalizeContext {
  scene: Pick<ReelScene, "text" | "visual" | "emphasis" | "items">;
  tokens: BrandTokens;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function replaceAll(haystack: string, needle: string, replacement: string): string {
  if (!needle) return haystack;
  return haystack.split(needle).join(replacement);
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

function domainPill(tokens: BrandTokens, visual: string | undefined, fallback: string): string {
  const fromVisual = visual?.trim();
  if (fromVisual) return fromVisual.replace(/^https?:\/\//, "").replace(/\/$/, "");
  const handle = tokens.handle?.trim();
  if (handle) return `${handle.replace(/^@/, "")}.com`;
  return fallback;
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
    const safe = JSON.stringify(w);
    return `          { text: ${safe}, start: ${start}, end: ${end} }`;
  });
  return `[\n${items.join(",\n")}\n        ]`;
}

function parseMoneyTarget(visual: string | undefined, text: string): number {
  const blob = `${visual ?? ""} ${text}`;
  const m = blob.match(/\$?\s*([\d]{1,3}(?:,\d{3})*(?:\.\d+)?|\d+(?:\.\d+)?)\s*([kKmMbB])?/);
  if (!m) return 10000;
  let n = Number(m[1].replace(/,/g, ""));
  if (!Number.isFinite(n)) return 10000;
  const suffix = (m[2] ?? "").toLowerCase();
  if (suffix === "k") n *= 1_000;
  if (suffix === "m") n *= 1_000_000;
  if (suffix === "b") n *= 1_000_000_000;
  return Math.max(1, Math.round(n));
}

function personalizeKineticSlam(html: string, ctx: CatalogPersonalizeContext): string {
  const literal = kineticWordsLiteral(ctx.scene.text);
  return html.replace(
    /var WORDS = \[[\s\S]*?\];/,
    `var WORDS = ${literal};`,
  );
}

function personalizeMoneyCount(html: string, ctx: CatalogPersonalizeContext): string {
  const target = parseMoneyTarget(ctx.scene.visual, ctx.scene.text);
  let out = html;
  out = out.replace(
    /Math\.min\(10000, value\)/g,
    `Math.min(${target}, value)`,
  );
  out = out.replace(/value:\s*10000/g, `value: ${target}`);
  out = out.replace(/renderAmount\(10000\)/g, `renderAmount(${target})`);
  return out;
}

function parseChartSeries(
  scene: Pick<ReelScene, "text" | "visual" | "items">,
): { revenue: number[]; conversion: number[] } {
  const blob = [
    scene.visual ?? "",
    ...(scene.items ?? []),
    scene.text,
  ].join(" ");
  const nums = [...blob.matchAll(/(\d+(?:\.\d+)?)/g)]
    .map((m) => Number(m[1]))
    .filter((n) => Number.isFinite(n) && n > 0)
    .slice(0, 12);

  const revenue: number[] = [];
  const conversion: number[] = [];
  if (nums.length >= 6) {
    for (let i = 0; i < 6; i++) {
      revenue.push(Math.max(1, Math.round(nums[i] % 40 || nums[i])));
      conversion.push(
        Math.max(0.5, Number((nums[i + 6] ?? nums[i] / 5).toFixed(1))),
      );
    }
  } else if (nums.length >= 3) {
    for (let i = 0; i < 6; i++) {
      const base = nums[i % nums.length];
      revenue.push(Math.max(1, Math.round(base * (0.7 + i * 0.12))));
      conversion.push(Math.max(0.5, Number((base / 8 + i * 0.3).toFixed(1))));
    }
  } else {
    // Deterministic fallback shaped by text length so charts aren't identical.
    const seed = Math.max(3, scene.text.length % 17);
    for (let i = 0; i < 6; i++) {
      revenue.push(8 + ((seed * (i + 3)) % 15));
      conversion.push(Number((2 + ((seed + i * 7) % 20) / 10).toFixed(1)));
    }
  }
  return { revenue, conversion };
}

function personalizeDataChart(html: string, ctx: CatalogPersonalizeContext): string {
  const title =
    ctx.scene.visual?.trim() ||
    ctx.scene.text.trim().slice(0, 64) ||
    "Monthly Revenue vs. Conversion Rate";
  const { revenue, conversion } = parseChartSeries(ctx.scene);
  const maxRevenue = Math.max(25, ...revenue) + 3;
  const maxConversion = Math.max(5, ...conversion) + 0.5;
  let out = replaceAll(html, "Monthly Revenue vs. Conversion Rate", title);
  out = out.replace(
    /const revenueData = \[[^\]]*\];/,
    `const revenueData = ${JSON.stringify(revenue)};`,
  );
  out = out.replace(
    /const conversionData = \[[^\]]*\];/,
    `const conversionData = ${JSON.stringify(conversion)};`,
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

function personalizeAppShowcase(html: string, ctx: CatalogPersonalizeContext): string {
  const headline = ctx.scene.text.trim().slice(0, 48) || "Unleash Full Potential";
  const cta = ctx.scene.visual?.trim() || "START NOW";
  let out = replaceAll(html, "Unleash Full Potential", headline);
  out = replaceAll(out, "START NOW", cta);
  return out;
}

function personalizeLogoOutro(html: string, ctx: CatalogPersonalizeContext): string {
  const tagline =
    ctx.scene.text.trim().slice(0, 80) || "Nothing great is made alone.";
  const pill = domainPill(ctx.tokens, ctx.scene.visual, "figma.com");
  const name = brandName(ctx.tokens, "Logo Outro");
  let out = replaceAll(html, "Nothing great is made alone.", tagline);
  out = replaceAll(out, "figma.com", pill);
  // Title text node used as logo label in the demo.
  out = out.replace(/>Logo Outro</g, `>${escapeHtmlText(name)}<`);
  return out;
}

function personalizeInstagram(html: string, ctx: CatalogPersonalizeContext): string {
  const name = brandName(ctx.tokens, "HeyGen");
  const handle = handleAt(ctx.tokens, "@heygen_official");
  const cta = ctx.scene.visual?.trim() || "Follow";
  let out = replaceAll(html, "@heygen_official", handle);
  out = replaceAll(out, "HeyGen", name);
  // Only replace the primary Follow label in the button (keep "Following").
  out = out.replace(/>Follow</g, `>${escapeHtmlText(cta)}<`);
  return out;
}

function personalizeTiktok(html: string, ctx: CatalogPersonalizeContext): string {
  const name = brandName(ctx.tokens, "HeyGen");
  const handle = handleAt(ctx.tokens, "@heygen.com");
  const cta = ctx.scene.visual?.trim() || "Follow";
  let out = replaceAll(html, "@heygen.com", handle);
  out = replaceAll(out, "HeyGen", name);
  out = out.replace(/>Follow</g, `>${escapeHtmlText(cta)}<`);
  return out;
}

function personalizeYtLowerThird(html: string, ctx: CatalogPersonalizeContext): string {
  const name = brandName(ctx.tokens, "HeyGen");
  const cta = ctx.scene.visual?.trim() || "Subscribe";
  let out = replaceAll(html, "HeyGen", name);
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
  const scripts = [...fullHtml.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi)]
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
  // Lazy import cycle avoidance — re-export lookup.
  const { getCatalogBlockByTemplateId } = require("./manifest") as typeof import("./manifest");
  return getCatalogBlockByTemplateId(templateId);
}

// Prefer static import for callers; keep require only for the helper above out.
void getCatalogBlockById;
void escapeRegExp;
