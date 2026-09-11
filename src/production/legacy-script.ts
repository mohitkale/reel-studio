import { createHash } from "node:crypto";

import type { ScriptDTO, VoiceTakeDTO } from "@/lib/dto";
import { orientationFromDims } from "@/lib/orientation";
import { resolveReelTimeline } from "@/lib/reel-timeline";
import { resolveReelSfxCues } from "@/lib/sfx-cues";
import { resolveSpokenText } from "@/lib/spoken-text";
import { getVideoEngine } from "@/engines/registry";
import type { ProductionSceneRole } from "@/production/roles";
import {
  LEGACY_PRESET_ID,
  LEGACY_PRESET_VERSION,
  PRODUCTION_SPEC_VERSION,
  productionSpecSchema,
  type ProductionAsset,
  type ProductionOutput,
  type ProductionSpec,
} from "@/production/spec";

export interface LegacyProductionSpecOptions {
  sourceRevision: string;
  voiceTakeId?: string;
  createdAt?: string;
  requestedOutputs?: ProductionOutput[];
}

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.entries(value)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, item]) => `${JSON.stringify(key)}:${stableJson(item)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value) ?? "null";
}

function contentHash(script: ScriptDTO): string {
  const content = {
    id: script.id,
    engine: script.videoEngine,
    fps: script.fps,
    width: script.width,
    height: script.height,
    scenes: script.scenes,
    brandKitId: script.brandKitId,
    brandTokens: script.brandTokens,
    coverUrl: script.coverUrl,
    musicUrl: script.musicUrl,
    musicVolume: script.musicVolume,
    sfxEnabled: script.sfxEnabled,
    sfxJson: script.sfxJson,
    hideText: script.hideText,
    hideProgressBar: script.hideProgressBar,
    styleId: script.styleId,
    energy: script.energy,
  };
  return `sha256:${createHash("sha256").update(stableJson(content)).digest("hex")}`;
}

function inferLegacyRole(templateId: string): ProductionSceneRole {
  if (/logo/.test(templateId)) return "logo";
  if (/cta|follow|lower-third/.test(templateId)) return "cta";
  if (/data-chart/.test(templateId)) return "chart";
  if (/stat|money-count/.test(templateId)) return "metric";
  if (/quote/.test(templateId)) return "quote";
  if (/app-showcase/.test(templateId)) return "screenshot-demo";
  if (/lottie/.test(templateId)) return "diagram";
  if (/three/.test(templateId)) return "hero";
  if (/list|icon-grid/.test(templateId)) return "tip";
  if (/opener|kinetic|emoji-punch/.test(templateId)) return "hook";
  return "explanation";
}

function narrationReadiness(
  take: VoiceTakeDTO | null,
  takeUsable: boolean,
): ProductionSpec["narration"]["readiness"] {
  if (!take) return "missing";
  if (!takeUsable) return "stale";
  return take.isPlaceholder ? "placeholder" : "ready";
}

/**
 * Snapshot an existing v0.3 script without changing its engine or stored template ids.
 * The returned spec is immutable job input: all inherited brand, timing and media
 * decisions are resolved before it reaches an engine adapter.
 */
export function productionSpecFromLegacyScript(
  script: ScriptDTO,
  options: LegacyProductionSpecOptions,
): ProductionSpec {
  const engine = getVideoEngine(script.videoEngine);
  const take = options.voiceTakeId
    ? (script.takes.find((candidate) => candidate.id === options.voiceTakeId) ??
      null)
    : null;
  const spokenScenes = script.scenes.map((scene) => ({
    id: scene.id,
    text: resolveSpokenText(scene),
  }));
  const resolved = resolveReelTimeline(spokenScenes, take, script.fps);
  const timingByScene = new Map(
    resolved.timeline.map((beat) => [beat.sceneId, beat] as const),
  );

  const assets: ProductionAsset[] = [];
  if (script.coverUrl) {
    assets.push({
      id: "asset:cover",
      type: "image",
      uri: script.coverUrl,
      source: "legacy",
    });
  }
  if (script.musicUrl) {
    assets.push({
      id: "asset:music",
      type: "audio",
      uri: script.musicUrl,
      source: "legacy",
    });
  }
  if (take) {
    assets.push({
      id: `asset:narration:${take.id}`,
      type: "audio",
      uri: take.audioUrl,
      source: "legacy",
    });
  }

  const backgroundAssetByScene = new Map<string, string>();
  for (const scene of script.scenes) {
    if (!scene.background) continue;
    const assetId = `asset:scene:${scene.id}:background`;
    backgroundAssetByScene.set(scene.id, assetId);
    assets.push({
      id: assetId,
      type: scene.background.type,
      uri: scene.background.url,
      source: "legacy",
    });
  }

  const sfx = resolveReelSfxCues({
    sfxEnabled: script.sfxEnabled,
    sfxJson: script.sfxJson,
    timeline: resolved.timeline,
    fps: script.fps,
  }).map((cue, index) => {
    const assetRef = `asset:sfx:${index}`;
    assets.push({
      id: assetRef,
      type: "audio",
      uri: cue.url,
      source: "bundled",
    });
    return { assetRef, startFrame: cue.startFrame, volume: cue.volume };
  });

  const orientation = orientationFromDims(script.width, script.height);
  const coverFrames = script.coverUrl ? Math.round(script.fps * 1.5) : 0;
  const defaultOutputs: ProductionOutput[] = [
    {
      kind: "video",
      format: "mp4",
      orientation,
      quality: "standard",
    },
  ];

  return productionSpecSchema.parse({
    schemaVersion: PRODUCTION_SPEC_VERSION,
    id: `legacy:${script.id}:${options.sourceRevision}`,
    createdAt: options.createdAt ?? new Date().toISOString(),
    productionKind: "video",
    source: {
      kind: "script",
      id: script.id,
      revision: options.sourceRevision,
      contentHash: contentHash(script),
    },
    engine: {
      id: script.videoEngine,
      adapterVersion: "1.0.0",
      catalogRevision: "builtin-v0.3.0",
    },
    preset: {
      id: LEGACY_PRESET_ID,
      version: LEGACY_PRESET_VERSION,
    },
    brand: {
      brandKitId: script.brandKitId,
      tokens: { ...script.brandTokens },
      styleId: script.styleId,
      energy: script.energy,
    },
    canvas: {
      orientation,
      width: script.width,
      height: script.height,
      fps: script.fps,
    },
    assets,
    scenes: script.scenes.map((scene) => {
      const timing = timingByScene.get(scene.id);
      if (!timing)
        throw new Error(`Missing timing for legacy scene ${scene.id}`);
      const backgroundAsset = backgroundAssetByScene.get(scene.id);
      return {
        id: scene.id,
        order: scene.order,
        role: inferLegacyRole(scene.templateId),
        template: {
          sourceId: scene.templateId,
          resolvedId: engine.normalizeTemplateId(scene.templateId),
          version: LEGACY_PRESET_VERSION,
        },
        displayText: scene.text,
        narrationText: resolveSpokenText(scene),
        emphasis: [...scene.emphasis],
        visual: scene.visual,
        items: scene.items ? [...scene.items] : undefined,
        assetRefs: backgroundAsset ? [backgroundAsset] : [],
        timing: {
          startFrame: timing.startFrame,
          durationFrames: Math.max(1, timing.durationFrames),
        },
        locks: { copy: false, assets: false, scene: false },
        presentation: {
          hideText: scene.hideText ?? script.hideText,
          mood: scene.mood,
        },
      };
    }),
    narration: {
      mode: script.voiceMode,
      readiness: narrationReadiness(take, resolved.takeUsable),
      takeId: take?.id,
      providerId: take?.providerId,
      voiceId: take?.voiceId,
      modelId: take?.modelId,
      audioAssetRef: take ? `asset:narration:${take.id}` : undefined,
    },
    captions: {
      enabled: false,
      timingSource: "estimated",
      cues: [],
    },
    audio: {
      musicAssetRef: script.musicUrl ? "asset:music" : undefined,
      musicVolume: script.musicVolume / 100,
      sfx,
    },
    timing: {
      contentFrames: Math.max(1, resolved.totalFrames),
      coverFrames,
      totalFrames: Math.max(1, resolved.totalFrames) + coverFrames,
    },
    requestedOutputs: options.requestedOutputs ?? defaultOutputs,
  });
}
