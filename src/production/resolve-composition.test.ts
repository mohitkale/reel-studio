import { describe, expect, it } from "vitest";

import { buildHyperframesCompositionHtml } from "@/engines/hyperframes/build-composition";
import type { VideoEngineId } from "@/engines/types";
import { serverDefaultTokens } from "@/lib/brand-defaults";
import { dimsFor, ORIENTATIONS, type Orientation } from "@/lib/orientation";
import { resolveProductionComposition } from "@/production/resolve-composition";
import {
  PRODUCTION_SPEC_VERSION,
  productionSpecSchema,
  type ProductionSpec,
} from "@/production/spec";

function productionSpec(
  engineId: VideoEngineId,
  orientation: Orientation,
): ProductionSpec {
  const canvas = { ...dimsFor(orientation), fps: 30, orientation };
  const templateId = engineId === "hyperframes" ? "hf-opener" : "kinetic";
  return productionSpecSchema.parse({
    schemaVersion: PRODUCTION_SPEC_VERSION,
    id: `${engineId}-${orientation}`,
    createdAt: "2026-09-11T06:00:00.000Z",
    productionKind: "video",
    source: {
      kind: "brief",
      revision: "brief-1",
      contentHash:
        "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    },
    engine: {
      id: engineId,
      adapterVersion: "1.0.0",
      catalogRevision: "builtin-v0.3.0",
    },
    preset: { id: "product-launch", version: "1.0.0" },
    brand: {
      brandKitId: null,
      tokens: serverDefaultTokens,
      styleId: "clean-story",
      energy: "normal",
    },
    canvas,
    assets: [
      { id: "hero", type: "image", uri: "/media/hero.png", source: "uploaded" },
      {
        id: "voice",
        type: "audio",
        uri: "/media/voice.wav",
        source: "provider",
      },
      { id: "music", type: "audio", uri: "/music/bed.wav", source: "bundled" },
      { id: "hit", type: "audio", uri: "/sfx/hit.wav", source: "bundled" },
    ],
    scenes: [
      {
        id: "scene-1",
        order: 0,
        role: "hook",
        template: {
          sourceId: templateId,
          resolvedId: templateId,
          version: "legacy-v0.3.0",
        },
        displayText: "Build once. Publish everywhere.",
        narrationText: "Build it once, then publish it everywhere.",
        emphasis: ["everywhere"],
        assetRefs: ["hero"],
        timing: { startFrame: 0, durationFrames: 120 },
        locks: { copy: false, assets: false, scene: false },
        presentation: { hideText: false, mood: "tech" },
      },
    ],
    narration: {
      mode: "oneshot",
      readiness: "ready",
      takeId: "take-1",
      providerId: "kokoro",
      voiceId: "af_heart",
      audioAssetRef: "voice",
    },
    captions: { enabled: false, timingSource: "estimated", cues: [] },
    presentation: { hideProgressBar: true },
    audio: {
      musicAssetRef: "music",
      musicVolume: 0.2,
      sfx: [{ assetRef: "hit", startFrame: 30, volume: 0.5 }],
    },
    timing: { contentFrames: 120, coverFrames: 0, totalFrames: 120 },
    requestedOutputs: [
      { kind: "video", format: "mp4", orientation, quality: "standard" },
    ],
  });
}

describe("resolved production composition", () => {
  it.each(ORIENTATIONS)(
    "uses one format-aware input for both engines in %s",
    (orientation) => {
      for (const engineId of ["hyperframes", "remotion"] as const) {
        const spec = productionSpec(engineId, orientation);
        const resolved = resolveProductionComposition(
          spec,
          (asset) => `https://preview.invalid${asset.uri}`,
        );
        const dimensions = dimsFor(orientation);

        expect(resolved.layout.orientation).toBe(orientation);
        expect(resolved.layout).toMatchObject(dimensions);
        expect(resolved.reelProps.layout).toBe(resolved.layout);
        expect(resolved.reelProps.width).toBe(dimensions.width);
        expect(resolved.reelProps.height).toBe(dimensions.height);
        expect(resolved.reelProps.scenes[0].background?.url).toBe(
          "https://preview.invalid/media/hero.png",
        );
        expect(resolved.reelProps.audioUrl).toBe(
          "https://preview.invalid/media/voice.wav",
        );
        expect(resolved.reelProps.musicVolume).toBe(20);
        expect(resolved.reelProps.hideProgressBar).toBe(true);
      }
    },
  );

  it.each(ORIENTATIONS)(
    "embeds the resolved %s layout in HyperFrames preview/export HTML",
    (orientation) => {
      const resolved = resolveProductionComposition(
        productionSpec("hyperframes", orientation),
      );
      const html = buildHyperframesCompositionHtml(resolved.reelProps, {
        inlineCatalog: true,
      });

      expect(html).toContain(`data-orientation="${orientation}"`);
      expect(html).toContain(`data-width="${resolved.layout.width}"`);
      expect(html).toContain(`data-height="${resolved.layout.height}"`);
      expect(html).toContain(`--safe-top:${resolved.layout.safeArea.top}px`);
      expect(html).toContain(
        `--content-max-width:${resolved.layout.contentMaxWidth}px`,
      );
    },
  );

  it("does not expose placeholder narration as production audio", () => {
    const spec = productionSpec("remotion", "portrait");
    spec.narration.readiness = "placeholder";

    expect(
      resolveProductionComposition(spec).reelProps.audioUrl,
    ).toBeUndefined();
  });
});
