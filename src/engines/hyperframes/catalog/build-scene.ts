import { escapeHtml } from "@/lib/html";
import type { BrandTokens } from "@/video/tokens";
import type { ReelScene } from "@/video/types";
import {
  getCatalogBlockByTemplateId,
  type HfCatalogBlockMeta,
} from "@/engines/hyperframes/catalog/manifest";
import { buildNativeCatalogVisual } from "@/engines/hyperframes/catalog/native-visuals";

export const NATIVE_ONLY_BLOCKS = new Set([
  "apple-money-count",
  "data-chart",
  "app-showcase",
  "carousel-circle-1",
  "carousel-path-1",
  "carousel-vision-1",
]);

function hasExplicitMetric(value: string | undefined): boolean {
  return Boolean(
    value && /[-+]?\d+(?:[.,]\d+)*(?:\s*[%×xkKmMbB])?/.test(value),
  );
}

function hasRequiredInputs(
  meta: HfCatalogBlockMeta,
  scene: ReelScene,
): boolean {
  if (meta.id === "data-chart") return Boolean(scene.chart);
  if (meta.id === "apple-money-count") return hasExplicitMetric(scene.visual);
  if (meta.id === "app-showcase") return Boolean(scene.background?.url);
  if (meta.requiresCarouselImages)
    return (scene.carouselImages?.length ?? 0) >= 3;
  return true;
}

export interface CatalogSceneBuild {
  /** Outer scene markup (section + host). */
  html: string;
  meta: HfCatalogBlockMeta;
}

/**
 * Build a catalog-inspired scene that is always visible on portrait stages.
 *
 * Upstream HyperFrames registry blocks are landscape GSAP compositions; nesting
 * them via data-composition-src is valuable for producer renders, but their
 * default markup is blank until GSAP invents DOM nodes — which makes editor
 * preview look like "just mood colors". We therefore paint a portrait-native
 * production visual in the host, and still emit composition-src so a future
 * producer path can prefer the upstream timeline when available.
 */
export function buildCatalogSceneBlock(args: {
  scene: ReelScene;
  tokens: BrandTokens;
  absoluteStart: number;
  duration: number;
  exitWindow: number;
  transitionClass: string;
  accent: string;
  motionStiffness: string;
  backgroundHtml: string;
  catalogRevision?: string;
}): CatalogSceneBuild | null {
  const meta = getCatalogBlockByTemplateId(
    args.scene.templateId,
    args.catalogRevision,
  );
  if (!meta) return null;
  if (!hasRequiredInputs(meta, args.scene)) return null;

  const native = buildNativeCatalogVisual({
    meta,
    scene: args.scene,
    tokens: args.tokens,
  });
  if (!native) return null;
  const nativeOnly = NATIVE_ONLY_BLOCKS.has(meta.id);
  const srcName = catalogCompositionFileName(meta.id, args.scene.id);
  // Prefer real stock photos when present; otherwise keep native mood stages
  // (flat CSS washes look low-effort under VO).
  const hasMedia = /class="(?:bg-photo|bg-scrim)/.test(args.backgroundHtml);
  const bg = hasMedia ? args.backgroundHtml : "";

  const html = `
      <section id="scene-${escapeHtml(args.scene.id)}" class="clip scene catalog-scene ${args.transitionClass}${hasMedia ? " has-photo" : ""}"
               data-scene-id="${escapeHtml(args.scene.id)}"
               data-catalog-block="${escapeHtml(meta.id)}"
               data-start="${args.absoluteStart.toFixed(3)}"
               data-duration="${args.duration.toFixed(3)}"
               data-track-index="1"
               data-exit-window="${args.exitWindow.toFixed(3)}"
               style="--accent:${args.accent};--motion-stiffness:${args.motionStiffness}">
        ${bg}
        <div id="catalog-host-${escapeHtml(args.scene.id)}" class="clip catalog-host"${
          nativeOnly
            ? ""
            : `
             data-composition-id="${escapeHtml(meta.compositionId)}"
             data-composition-src="compositions/${escapeHtml(srcName)}"`
        }
             data-start="${args.absoluteStart.toFixed(3)}"
             data-duration="${args.duration.toFixed(3)}"
             data-track-index="2"
             data-width="${meta.width}"
             data-height="${meta.height}">
          ${native}
        </div>
      </section>`;

  return {
    html,
    meta,
  };
}

export function catalogCompositionFileName(
  blockId: string,
  sceneId: string,
): string {
  return `${blockId}--${sceneId}.html`;
}
