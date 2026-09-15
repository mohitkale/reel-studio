import { describe, expect, it } from "vitest";

import type { ScriptDTO } from "@/lib/dto";
import { defaultBrandTokens } from "@/compositions/tokens";
import { getVideoEngine, listVideoEngines } from "@/engines/registry";
import { PRODUCTION_PRESETS } from "@/production/presets";
import { productionSpecFromLegacyScript } from "@/production/legacy-script";
import { productionSpecSchema } from "@/production/spec";

function legacyScript(): ScriptDTO {
  return {
    id: "script-1",
    projectId: "project-1",
    name: "Legacy reel",
    fps: 30,
    width: 1080,
    height: 1920,
    videoEngine: "remotion",
    scenes: [
      {
        id: "scene-1",
        scriptId: "script-1",
        order: 0,
        templateId: "placeholder",
        text: "A clear opening",
        spokenText: null,
        emphasis: ["clear"],
        background: {
          type: "image",
          url: "/media/opening.png",
          effect: "ken-burns",
        },
        hideText: null,
        mood: "tech",
        selectedVoiceClipId: null,
      },
      {
        id: "scene-2",
        scriptId: "script-1",
        order: 1,
        templateId: "stat-reveal",
        text: "Three useful outcomes",
        spokenText: "This produces three useful outcomes.",
        emphasis: ["three"],
        visual: "3",
        hideText: true,
        selectedVoiceClipId: null,
      },
    ],
    takes: [
      {
        id: "take-1",
        scriptId: "script-1",
        label: "Final",
        providerId: "kokoro",
        voiceId: "af_heart",
        modelId: null,
        fps: 30,
        totalFrames: 150,
        timeline: [
          {
            sceneId: "old-scene-1",
            startFrame: 0,
            durationFrames: 60,
            text: "A clear opening",
          },
          {
            sceneId: "old-scene-2",
            startFrame: 60,
            durationFrames: 90,
            text: "This produces three useful outcomes.",
          },
        ],
        audioUrl: "/media/takes/take-1.wav",
        isPlaceholder: false,
        source: "oneshot",
        createdAt: "2026-08-06T10:00:00.000Z",
      },
    ],
    voiceClips: [],
    voiceMode: "oneshot",
    brandKitId: "brand-1",
    brandTokens: { ...defaultBrandTokens, handle: "@legacy" },
    coverUrl: "/media/cover.png",
    musicUrl: "/music/bed.wav",
    musicVolume: 25,
    sfxEnabled: true,
    sfxJson: JSON.stringify({
      enabled: true,
      cues: [
        {
          sceneId: "scene-2",
          sfxId: "soft-hit",
          offsetSeconds: 0.25,
          volume: 0.4,
        },
      ],
    }),
    hideText: false,
    hideProgressBar: false,
    styleId: "clean-story",
    energy: "normal",
  };
}

describe("production presets", () => {
  it("publishes six versioned presets for both engines", () => {
    expect(PRODUCTION_PRESETS).toHaveLength(6);
    expect(new Set(PRODUCTION_PRESETS.map((preset) => preset.id)).size).toBe(6);
    for (const preset of PRODUCTION_PRESETS) {
      expect(preset.version).toBe("1.0.0");
      expect(preset.engines).toEqual(["hyperframes", "remotion"]);
      expect(preset.sceneRoles.length).toBeGreaterThan(0);
      expect(preset.defaults.maxSceneFrames).toBeGreaterThanOrEqual(
        preset.defaults.minSceneFrames,
      );
    }
  });

  it("exposes template capabilities through both engine adapters", () => {
    for (const engine of listVideoEngines()) {
      expect(engine.capabilities.aspectRatios).toEqual([
        "portrait",
        "landscape",
        "square",
      ]);
      for (const template of engine.listTemplates()) {
        const capabilities = engine.capabilities.templates[template.id];
        expect(capabilities.templateId).toBe(template.id);
        expect(capabilities.sceneRoles.length).toBeGreaterThan(0);
        expect(capabilities.requiredInputs.length).toBeGreaterThan(0);
        expect(capabilities.effects.length).toBeGreaterThan(0);
      }
    }
  });
});

describe("legacy production specification", () => {
  it("snapshots engine, brand, timing, media, narration, and stored template ids", () => {
    const spec = productionSpecFromLegacyScript(legacyScript(), {
      sourceRevision: "revision-7",
      voiceTakeId: "take-1",
      createdAt: "2026-09-11T05:30:00.000Z",
    });

    expect(productionSpecSchema.safeParse(spec).success).toBe(true);
    expect(spec.engine.id).toBe("remotion");
    expect(spec.preset).toEqual({ id: "legacy", version: "0.3.0" });
    expect(spec.brand.tokens.handle).toBe("@legacy");
    expect(spec.scenes[0].template).toEqual({
      sourceId: "placeholder",
      resolvedId: getVideoEngine("remotion").defaultTemplateId,
      version: "0.3.0",
    });
    expect(spec.scenes[1].role).toBe("metric");
    expect(spec.scenes[1].narrationText).toBe(
      "This produces three useful outcomes.",
    );
    expect(spec.scenes[1].presentation.hideText).toBe(true);
    expect(spec.narration.readiness).toBe("ready");
    expect(spec.timing).toEqual({
      contentFrames: 150,
      coverFrames: 45,
      totalFrames: 195,
    });
    expect(spec.assets.map((asset) => asset.id)).toEqual([
      "asset:cover",
      "asset:music",
      "asset:narration:take-1",
      "asset:scene:scene-1:background",
      "asset:sfx:0",
    ]);
    expect(spec.audio).toEqual({
      musicAssetRef: "asset:music",
      musicVolume: 0.25,
      sfx: [{ assetRef: "asset:sfx:0", startFrame: 68, volume: 0.4 }],
    });
  });

  it("marks changed narration as stale and falls back to estimated timing", () => {
    const script = legacyScript();
    script.scenes[0].text = "The opening changed";
    const spec = productionSpecFromLegacyScript(script, {
      sourceRevision: "revision-8",
      voiceTakeId: "take-1",
      createdAt: "2026-09-11T05:31:00.000Z",
    });

    expect(spec.narration.readiness).toBe("stale");
    expect(spec.timing.contentFrames).not.toBe(150);
  });

  it("rejects dangling asset references", () => {
    const spec = productionSpecFromLegacyScript(legacyScript(), {
      sourceRevision: "revision-9",
      createdAt: "2026-09-11T05:32:00.000Z",
    });
    spec.scenes[0].assetRefs.push("asset:missing");

    const result = productionSpecSchema.safeParse(spec);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toContain(
        "Unknown asset reference",
      );
    }
  });

  it("rejects invalid scene, caption, and chart timing data", () => {
    const spec = productionSpecFromLegacyScript(legacyScript(), {
      sourceRevision: "revision-10",
      createdAt: "2026-09-11T05:33:00.000Z",
    });
    spec.scenes[0].order = 1;
    spec.scenes[1].chart = {
      labels: ["Before", "After"],
      series: [{ label: "Exports", values: [12], unit: "videos" }],
    };
    spec.captions = {
      enabled: true,
      timingSource: "imported",
      style: spec.captions.style,
      cues: [
        {
          id: "cue-1",
          startFrame: 10,
          endFrame: spec.timing.contentFrames + 1,
          text: "Outside the timeline",
        },
      ],
    };

    const result = productionSpecSchema.safeParse(spec);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.map((issue) => issue.message)).toEqual(
        expect.arrayContaining([
          "Scenes must use contiguous order values starting at zero",
          "Chart values must match the number of labels",
          "Caption cue exceeds the content timeline",
        ]),
      );
    }
  });
});
