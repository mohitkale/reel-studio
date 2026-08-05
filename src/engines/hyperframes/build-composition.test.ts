import { describe, expect, it } from "vitest";

import { defaultBrandTokens } from "@/compositions/tokens";
import { buildHyperframesCompositionHtml } from "@/engines/hyperframes/build-composition";
import { mapScenesToEngineTemplates } from "@/engines/hyperframes/map-templates";
import { personalizeCatalogHtml } from "@/engines/hyperframes/catalog/personalize";
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
      styleId: "bold-hook",
      energy: "high",
    });

    expect(html).toContain('data-composition-id="reel"');
    expect(html).toContain('data-scene-id="s1"');
    expect(html).toContain('data-style="bold-hook"');
    expect(html).toContain('data-energy="high"');
    expect(html).toContain("style-accent-flash");
    expect(html).toContain("fx-dlg-opener");
    expect(html).toContain("fx-dlg-cta");
    expect(html).toContain("data-motion-scene");
    expect(html).toContain("window.__reelSeek");
    expect(html).toContain("window.__timelines");
    expect(html).toContain("fitStage");
    expect(html).toContain('id="fit-wrap"');
    expect(html).toContain("Stop");
    expect(html).toContain("scrolling");
    expect(html).toContain("fx-line-inner");
    expect(html).toContain("matters");
    expect(html).toContain('class="em"');
  });

  it("wires catalog templates with portrait-native production visuals", () => {
    const html = buildHyperframesCompositionHtml({
      scenes: [
        {
          id: "hook",
          templateId: "hf-kinetic-slam",
          text: "Ship ads that look expensive.",
          emphasis: ["expensive"],
          mood: "energetic",
        },
        {
          id: "cta",
          templateId: "hf-ig-follow",
          text: "Follow for drops.",
          emphasis: [],
          visual: "Follow",
          mood: "playful",
        },
      ],
      timeline: [
        { sceneId: "hook", startFrame: 0, durationFrames: 90 },
        { sceneId: "cta", startFrame: 90, durationFrames: 60 },
      ],
      width: 1080,
      height: 1920,
      fps: 30,
      tokens: { ...defaultBrandTokens, handle: "reelstudio" },
    });

    expect(html).toContain('data-catalog-block="caption-kinetic-slam"');
    expect(html).toContain("fx-stack");
    expect(html).toContain("fx-line-inner");
    expect(html).toContain("data-motion-scene");
    expect(html).toContain("Ship");
    expect(html).toContain('data-catalog-block="instagram-follow"');
    expect(html).toContain("fx-social-card");
    expect(html).toContain("gsap@3.14.2");
    expect(html).toContain("reelstudio");
  });

  it("keeps kinetic captions readable with motion stage", () => {
    const html = buildHyperframesCompositionHtml(
      {
        scenes: [
          {
            id: "hook",
            templateId: "hf-kinetic-slam",
            text: "One two three four.",
            emphasis: [],
            mood: "dramatic",
          },
        ],
        timeline: [{ sceneId: "hook", startFrame: 0, durationFrames: 90 }],
        width: 1080,
        height: 1920,
        fps: 30,
        tokens: defaultBrandTokens,
      },
      { inlineCatalog: true },
    );

    expect(html).toContain("slam-stack");
    expect(html).toContain("fx-line-inner");
    expect(html).toContain("One");
    expect(html).toContain("gsap.timeline");
    expect(html).toContain('data-recipe="void-slash"');
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

  it("maps remotion picks onto hyperframes catalog bookends", () => {
    const scenes = [
      { text: "Hook", templateId: "kinetic", emphasis: [] },
      { text: "Stat", templateId: "stat-reveal", emphasis: [], visual: "10x" },
      { text: "Bye", templateId: "emoji-punch", emphasis: [] },
    ] as AIScene[];
    const mapped = mapScenesToEngineTemplates(scenes, "hyperframes");
    expect(mapped.map((s) => s.templateId)).toEqual([
      "hf-kinetic-slam",
      "hf-money-count",
      "hf-ig-follow",
    ]);
  });
});

describe("personalizeCatalogHtml", () => {
  it("rewrites instagram follow brand fields", () => {
    const html = personalizeCatalogHtml("instagram-follow", {
      scene: { text: "Follow us", visual: "Follow", emphasis: [] },
      tokens: { ...defaultBrandTokens, handle: "acme" },
    });
    expect(html).toContain("@acme");
    expect(html).toContain("acme");
    expect(html).not.toContain("@heygen_official");
  });
});
