import type { BrandTokens } from "@/compositions/tokens";
import type { ReelScene } from "@/compositions/types";
import {
  getCatalogBlockByTemplateId,
  type HfCatalogBlockMeta,
} from "@/engines/hyperframes/catalog/manifest";
import { personalizeCatalogBlock } from "@/engines/hyperframes/catalog/personalize";
import { buildNativeCatalogVisual } from "@/engines/hyperframes/catalog/native-visuals";

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export interface CatalogSceneBuild {
  /** Outer scene markup (section + host). */
  html: string;
  gsapNeeded: boolean;
  meta: HfCatalogBlockMeta;
  /** Relative composition filename written for producer / future nesting. */
  compositionFile: string;
  /** Fully personalized upstream HTML (kept on disk for render experiments). */
  personalizedHtml: string;
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
  inline: boolean;
  backgroundHtml: string;
}): CatalogSceneBuild | null {
  const meta = getCatalogBlockByTemplateId(args.scene.templateId);
  if (!meta) return null;

  const personalized = personalizeCatalogBlock(meta, {
    scene: args.scene,
    tokens: args.tokens,
  });

  const native = buildNativeCatalogVisual({
    meta,
    scene: args.scene,
    tokens: args.tokens,
  });
  if (!native) return null;

  const srcName = `${meta.id}--${args.scene.id}.html`;
  // Prefer real stock photos when present; otherwise keep native mood stages
  // (flat CSS washes look low-effort under VO).
  const hasPhoto = /class="bg-photo/.test(args.backgroundHtml);
  const bg = hasPhoto ? args.backgroundHtml : "";

  const html = `
      <section id="scene-${escapeHtml(args.scene.id)}" class="clip scene catalog-scene ${args.transitionClass}${hasPhoto ? " has-photo" : ""}"
               data-scene-id="${escapeHtml(args.scene.id)}"
               data-catalog-block="${escapeHtml(meta.id)}"
               data-start="${args.absoluteStart.toFixed(3)}"
               data-duration="${args.duration.toFixed(3)}"
               data-track-index="1"
               data-exit-window="${args.exitWindow.toFixed(3)}"
               style="--accent:${args.accent};--motion-stiffness:${args.motionStiffness}">
        ${bg}
        <div class="catalog-host"
             data-composition-id="${escapeHtml(meta.compositionId)}"
             data-composition-src="compositions/${escapeHtml(srcName)}"
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
    gsapNeeded: false,
    meta,
    compositionFile: srcName,
    personalizedHtml: personalized,
  };
}

export function catalogBlocksUsedInScenes(
  scenes: Array<{ templateId: string }>,
): HfCatalogBlockMeta[] {
  const seen = new Set<string>();
  const out: HfCatalogBlockMeta[] = [];
  for (const scene of scenes) {
    const meta = getCatalogBlockByTemplateId(scene.templateId);
    if (!meta || seen.has(meta.id)) continue;
    seen.add(meta.id);
    out.push(meta);
  }
  return out;
}

export function catalogCompositionFileName(
  blockId: string,
  sceneId: string,
): string {
  return `${blockId}--${sceneId}.html`;
}
