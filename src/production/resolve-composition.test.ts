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
import productLaunchFixture from "../../tests/fixtures/product-launch-reel.json";
import editorialExplainerFixture from "../../tests/fixtures/editorial-explainer-reel.json";
import creatorPunchFixture from "../../tests/fixtures/creator-punch-reel.json";
import dataStoryFixture from "../../tests/fixtures/data-story-reel.json";
import developerDemoFixture from "../../tests/fixtures/developer-demo-reel.json";
import cinematicBrandFixture from "../../tests/fixtures/cinematic-brand-reel.json";
import type { ReelProps } from "@/compositions/types";
import { reelDurationFrames } from "@/compositions/types";
import { CURRENT_HF_CATALOG_REVISION } from "@/engines/hyperframes/catalog/revisions";

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
        expect(resolved.reelProps.preset).toEqual({
          id: "product-launch",
          version: "1.0.0",
        });
        expect(resolved.reelProps.scenes[0].role).toBe("hook");
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

  it("retains the saved catalog version and resolves every carousel image", () => {
    const spec = productionSpec("hyperframes", "square");
    spec.engine.catalogRevision = CURRENT_HF_CATALOG_REVISION;
    spec.scenes[0].template.resolvedId = "hf-carousel-path-v1";
    spec.scenes[0].assetRefs = ["hero", "gallery-2", "gallery-3"];
    spec.assets.push(
      {
        id: "gallery-2",
        type: "image",
        uri: "/media/gallery-2.png",
        source: "uploaded",
      },
      {
        id: "gallery-3",
        type: "image",
        uri: "/media/gallery-3.png",
        source: "uploaded",
      },
    );

    const resolved = resolveProductionComposition(spec);
    expect(resolved.reelProps.catalogRevision).toBe(
      CURRENT_HF_CATALOG_REVISION,
    );
    expect(resolved.reelProps.scenes[0].carouselImages).toEqual([
      "/media/hero.png",
      "/media/gallery-2.png",
      "/media/gallery-3.png",
    ]);
  });

  it("renders the complete Product Launch role sequence in HyperFrames", () => {
    const html = buildHyperframesCompositionHtml(
      productLaunchFixture as ReelProps,
    );

    expect(html.match(/data-production-preset="product-launch"/g)).toHaveLength(
      5,
    );
    for (const role of [
      "hook",
      "screenshot-demo",
      "feature",
      "comparison",
      "cta",
    ]) {
      expect(html).toContain(`data-scene-role="${role}"`);
    }
    expect(html).toContain("product-launch-dashboard.svg");
    expect(html).toContain("pl-device");
    expect(html).toContain("Start creating");
  });

  it("rejects a Product Launch screenshot scene without supplied media", () => {
    const spec = productionSpec("hyperframes", "portrait");
    spec.scenes[0].role = "screenshot-demo";
    spec.scenes[0].assetRefs = [];

    const result = productionSpecSchema.safeParse(spec);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.map((issue) => issue.message)).toContain(
        "Product Launch screenshot demos require an image or video asset",
      );
    }
  });

  it("renders the complete Editorial Explainer role sequence in HyperFrames", () => {
    const html = buildHyperframesCompositionHtml(
      editorialExplainerFixture as ReelProps,
    );

    expect(
      html.match(/data-production-preset="editorial-explainer"/g),
    ).toHaveLength(5);
    for (const role of [
      "headline",
      "explanation",
      "diagram",
      "quote",
      "summary",
    ]) {
      expect(html).toContain(`data-scene-role="${role}"`);
    }
    expect(html).toContain("ed-diagram");
    expect(html).toContain("ed-quote");
    expect(html).toContain("Editorial principle");
    expect(reelDurationFrames(editorialExplainerFixture as ReelProps)).toBe(
      360,
    );
  });

  it("renders the complete Creator Punch role sequence in HyperFrames", () => {
    const html = buildHyperframesCompositionHtml(
      creatorPunchFixture as ReelProps,
    );

    expect(html.match(/data-production-preset="creator-punch"/g)).toHaveLength(
      5,
    );
    for (const role of ["hook", "tip", "emphasis", "payoff", "cta"]) {
      expect(html).toContain(`data-scene-role="${role}"`);
    }
    expect(html).toContain("cp-tips");
    expect(html).toContain("Create your first cut");
    expect(reelDurationFrames(creatorPunchFixture as ReelProps)).toBe(300);
  });

  it("renders supplied Data Story values and attribution without substitution", () => {
    const html = buildHyperframesCompositionHtml(dataStoryFixture as ReelProps);

    expect(html.match(/data-production-preset="data-story"/g)).toHaveLength(4);
    for (const role of ["metric", "chart", "comparison", "takeaway"]) {
      expect(html).toContain(`data-scene-role="${role}"`);
    }
    for (const value of ["72%", "8", "12", "15", "21", "18", "6"]) {
      expect(html).toContain(value);
    }
    expect(html).toContain("Reel Studio demo fixture");
    expect(reelDurationFrames(dataStoryFixture as ReelProps)).toBe(315);
  });

  it("rejects Data Story metric and chart roles without explicit data", () => {
    const missingMetric = productionSpec("remotion", "portrait");
    missingMetric.preset = { id: "data-story", version: "1.0.0" };
    missingMetric.scenes[0].role = "metric";
    delete missingMetric.scenes[0].visual;
    expect(productionSpecSchema.safeParse(missingMetric).success).toBe(false);

    missingMetric.scenes[0].role = "chart";
    const result = productionSpecSchema.safeParse(missingMetric);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.map((issue) => issue.message)).toContain(
        "Data Story chart scenes require structured chart data",
      );
    }
  });

  it("renders escaped Developer Demo code, diff, terminal, browser, and CTA roles", () => {
    const html = buildHyperframesCompositionHtml(
      developerDemoFixture as ReelProps,
    );
    expect(html.match(/data-production-preset="developer-demo"/g)).toHaveLength(
      5,
    );
    for (const role of ["code", "diff", "terminal", "browser", "cta"]) {
      expect(html).toContain(`data-scene-role="${role}"`);
    }
    expect(html).toContain("const production = schema.parse(input);");
    expect(html).toContain("change.diff");
    expect(html).toContain("developer-demo-browser.svg");
    expect(html).toContain("npm run produce");
    expect(reelDurationFrames(developerDemoFixture as ReelProps)).toBe(360);
  });

  it("rejects a Developer Demo browser scene without supplied media", () => {
    const spec = productionSpec("hyperframes", "portrait");
    spec.preset = { id: "developer-demo", version: "1.0.0" };
    spec.scenes[0].role = "browser";
    spec.scenes[0].assetRefs = [];
    const result = productionSpecSchema.safeParse(spec);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.map((issue) => issue.message)).toContain(
        "Developer Demo browser scenes require an image or video asset",
      );
    }
  });

  it("renders the complete Cinematic Brand role sequence", () => {
    const html = buildHyperframesCompositionHtml(
      cinematicBrandFixture as ReelProps,
    );
    expect(
      html.match(/data-production-preset="cinematic-brand"/g),
    ).toHaveLength(4);
    for (const role of ["hero", "feature", "testimonial", "logo"]) {
      expect(html).toContain(`data-scene-role="${role}"`);
    }
    expect(html).toContain("cinematic-brand-hero.svg");
    expect(html).toContain("Sample creative review");
    expect(html).toContain("cb-mark");
    expect(reelDurationFrames(cinematicBrandFixture as ReelProps)).toBe(360);
  });

  it("rejects a Cinematic Brand hero without supplied media", () => {
    const spec = productionSpec("remotion", "portrait");
    spec.preset = { id: "cinematic-brand", version: "1.0.0" };
    spec.scenes[0].role = "hero";
    spec.scenes[0].assetRefs = [];
    const result = productionSpecSchema.safeParse(spec);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.map((issue) => issue.message)).toContain(
        "Cinematic Brand hero scenes require an image or video asset",
      );
    }
  });
});
