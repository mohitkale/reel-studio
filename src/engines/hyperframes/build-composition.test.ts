import { describe, expect, it } from "vitest";

import { defaultBrandTokens } from "@/compositions/tokens";
import { buildHyperframesCompositionHtml } from "@/engines/hyperframes/build-composition";
import { mapScenesToEngineTemplates } from "@/engines/hyperframes/map-templates";
import type { AIScene } from "@/providers/ai/types";

describe("buildHyperframesCompositionHtml", () => {
  it("emits a HyperFrames root with scene clips and seek API", () => {
    const html = buildHyperframesCompositionHtml({
      scenes: [
        {
          id: "s1",
          templateId: "hf-opener",
          text: "Stop scrolling. This matters.",
          emphasis: ["matters"],
          mood: "dramatic",
        },
        {
          id: "s2",
          templateId: "hf-cta",
          text: "Follow for more.",
          emphasis: ["Follow"],
          visual: "Subscribe",
        },
      ],
      timeline: [
        { sceneId: "s1", startFrame: 0, durationFrames: 60 },
        { sceneId: "s2", startFrame: 60, durationFrames: 45 },
      ],
      width: 1080,
      height: 1920,
      fps: 30,
      tokens: defaultBrandTokens,
    });

    expect(html).toContain('data-composition-id="reel"');
    expect(html).toContain('data-scene-id="s1"');
    expect(html).toContain("tpl-opener");
    expect(html).toContain("tpl-cta");
    expect(html).toContain("window.__reelSeek");
    expect(html).toContain("fitStage");
    expect(html).toContain('id="fit-wrap"');
    expect(html).toContain("Stop scrolling");
    expect(html).toContain('<span class="em">matters</span>');
  });
});

describe("mapScenesToEngineTemplates", () => {
  it("leaves remotion scenes unchanged", () => {
    const scenes = [
      {
        text: "Hello",
        templateId: "kinetic",
        emphasis: [],
      },
    ] as AIScene[];
    expect(mapScenesToEngineTemplates(scenes, "remotion")[0].templateId).toBe(
      "kinetic",
    );
  });

  it("maps remotion picks onto hyperframes bookends", () => {
    const scenes = [
      { text: "Hook", templateId: "kinetic", emphasis: [] },
      { text: "Stat", templateId: "stat-reveal", emphasis: [], visual: "10x" },
      { text: "Bye", templateId: "emoji-punch", emphasis: [] },
    ] as AIScene[];
    const mapped = mapScenesToEngineTemplates(scenes, "hyperframes");
    expect(mapped.map((s) => s.templateId)).toEqual([
      "hf-opener",
      "hf-stat",
      "hf-cta",
    ]);
  });
});
