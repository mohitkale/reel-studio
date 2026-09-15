import type { ReelProps, ReelScene } from "@/compositions/types";
import { getVideoEngine } from "@/engines/registry";
import {
  productionSpecSchema,
  type ProductionAsset,
  type ProductionSpec,
} from "@/production/spec";
import {
  resolveProductionLayout,
  type ProductionLayout,
} from "@/production/layout";

export type ProductionAssetUriResolver = (asset: ProductionAsset) => string;

export interface ResolvedProductionComposition {
  productionId: string;
  engineId: ProductionSpec["engine"]["id"];
  catalogRevision: string;
  layout: ProductionLayout;
  totalFrames: number;
  reelProps: ReelProps;
}

function resolveAsset(
  assets: ReadonlyMap<string, ProductionAsset>,
  id: string | undefined,
  resolveUri: ProductionAssetUriResolver,
): string | undefined {
  if (!id) return undefined;
  const asset = assets.get(id);
  if (!asset) throw new Error(`Production asset is missing: ${id}`);
  return resolveUri(asset);
}

/**
 * Convert one immutable production snapshot into the exact props shared by an
 * engine's preview and export. URI mapping is the only environment-specific
 * operation: browsers can return app URLs while workers return local paths.
 */
export function resolveProductionComposition(
  input: ProductionSpec,
  resolveUri: ProductionAssetUriResolver = (asset) => asset.uri,
): ResolvedProductionComposition {
  const spec = productionSpecSchema.parse(input);
  const engine = getVideoEngine(spec.engine.id);
  const assets = new Map(
    spec.assets.map((asset) => [asset.id, asset] as const),
  );
  const layout = resolveProductionLayout(spec.canvas);

  const scenes: ReelScene[] = spec.scenes.map((scene) => {
    const templateId = engine.normalizeTemplateId(scene.template.resolvedId);
    const backgroundAsset = scene.assetRefs
      .map((assetRef) => assets.get(assetRef))
      .find((asset) => asset?.type === "image" || asset?.type === "video");

    return {
      id: scene.id,
      templateId,
      text: scene.displayText,
      emphasis: [...scene.emphasis],
      visual: scene.visual,
      items: scene.items ? [...scene.items] : undefined,
      chart: scene.chart
        ? {
            ...scene.chart,
            labels: [...scene.chart.labels],
            series: scene.chart.series.map((series) => ({
              ...series,
              values: [...series.values],
            })),
          }
        : undefined,
      role: scene.role,
      background: backgroundAsset
        ? {
            type: backgroundAsset.type as "image" | "video",
            url: resolveUri(backgroundAsset),
            ...(backgroundAsset.type === "image"
              ? { effect: "ken-burns" as const }
              : { muted: true }),
          }
        : undefined,
      hideText: scene.presentation.hideText,
      mood: scene.presentation.mood as ReelScene["mood"],
      order: scene.order,
    };
  });

  const narrationReady = spec.narration.readiness === "ready";
  const coverAsset = assets.get("asset:cover");
  const reelProps: ReelProps = {
    scenes,
    timeline: spec.scenes.map((scene) => ({
      sceneId: scene.id,
      startFrame: scene.timing.startFrame,
      durationFrames: scene.timing.durationFrames,
    })),
    audioUrl: narrationReady
      ? resolveAsset(assets, spec.narration.audioAssetRef, resolveUri)
      : undefined,
    musicUrl: resolveAsset(assets, spec.audio.musicAssetRef, resolveUri),
    musicVolume: spec.audio.musicVolume * 100,
    sfxCues: spec.audio.sfx.map((cue) => ({
      url: resolveAsset(assets, cue.assetRef, resolveUri)!,
      startFrame: cue.startFrame,
      volume: cue.volume,
    })),
    tokens: { ...spec.brand.tokens },
    coverUrl: coverAsset ? resolveUri(coverAsset) : undefined,
    width: spec.canvas.width,
    height: spec.canvas.height,
    fps: spec.canvas.fps,
    hideProgressBar: spec.presentation.hideProgressBar,
    styleId: spec.brand.styleId,
    energy: spec.brand.energy,
    layout,
    preset:
      spec.preset.id === "legacy"
        ? undefined
        : { id: spec.preset.id, version: spec.preset.version },
    captions: {
      enabled: spec.captions.enabled,
      timingSource: spec.captions.timingSource,
      style: spec.captions.style,
      cues: spec.captions.cues.map((cue) => ({
        ...cue,
        words: cue.words?.map((word) => ({ ...word })),
      })),
    },
  };

  return {
    productionId: spec.id,
    engineId: spec.engine.id,
    catalogRevision: spec.engine.catalogRevision,
    layout,
    totalFrames: spec.timing.totalFrames,
    reelProps,
  };
}
