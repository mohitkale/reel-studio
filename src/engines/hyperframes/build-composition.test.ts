import { describe, expect, it } from "vitest";

import { defaultBrandTokens } from "@/compositions/tokens";
import { buildHyperframesCompositionHtml } from "@/engines/hyperframes/build-composition";
import { mapScenesToEngineTemplates } from "@/engines/hyperframes/map-templates";
import { personalizeCatalogHtml } from "@/engines/hyperframes/catalog/personalize";
import type { AIScene } from "@/providers/ai/types";
import { CAPTION_STYLE_PRESETS } from "@/lib/caption-style";
import {
  CURRENT_HF_CATALOG_REVISION,
  PREVIOUS_HF_CATALOG_REVISION,
} from "@/engines/hyperframes/catalog/revisions";
import { ORIENTATIONS, dimsFor } from "@/lib/orientation";

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

  it("scales the editor preview from the authored landscape dimensions", () => {
    const html = buildHyperframesCompositionHtml({
      scenes: [
        {
          id: "landscape-scene",
          templateId: "hf-statement",
          text: "Landscape content fills the preview.",
          emphasis: [],
        },
      ],
      timeline: [
        {
          sceneId: "landscape-scene",
          startFrame: 0,
          durationFrames: 60,
        },
      ],
      width: 1920,
      height: 1080,
      fps: 30,
      tokens: defaultBrandTokens,
    });

    expect(html).toContain('id="fit-wrap"');
    expect(html).toContain('data-width="1920"');
    expect(html).toContain('data-height="1080"');
    expect(html).toContain("Number(wrap.getAttribute('data-width'))");
    expect(html).toContain("Number(wrap.getAttribute('data-height'))");
    expect(html).not.toContain("Number(root.getAttribute('data-width'))");
    expect(html).toContain("el.style.visibility = on ? 'visible' : 'hidden'");
  });

  it("honors catalog and B-roll templates instead of flattening preset scenes", () => {
    const html = buildHyperframesCompositionHtml({
      scenes: [
        {
          id: "hook",
          role: "hook",
          templateId: "hf-kinetic-slam",
          text: "The speed headline is not the real story.",
          emphasis: ["real story"],
        },
        {
          id: "broll",
          role: "feature",
          templateId: "hf-broll",
          text: "Software teams need calibrated decisions.",
          emphasis: [],
          background: {
            type: "image",
            url: "/media/team.jpg",
            effect: "ken-burns",
          },
        },
        {
          id: "contrast",
          role: "comparison",
          templateId: "hf-quote",
          text: "Valid typed output can still be the wrong decision.",
          emphasis: [],
        },
      ],
      timeline: [
        { sceneId: "hook", startFrame: 0, durationFrames: 120 },
        { sceneId: "broll", startFrame: 120, durationFrames: 120 },
        { sceneId: "contrast", startFrame: 240, durationFrames: 120 },
      ],
      width: 1920,
      height: 1080,
      fps: 30,
      tokens: defaultBrandTokens,
      preset: { id: "product-launch", version: "1.0.0" },
    });

    expect(html).toContain('data-catalog-block="caption-kinetic-slam"');
    expect(html).toContain("fx-dlg-broll");
    expect(html).toContain("bg-photo");
    expect(html).toContain("fx-dlg-quote");
    expect(html).not.toContain("product-launch-scene");
  });

  it("renders editable subtitles as a separate timed track", () => {
    const html = buildHyperframesCompositionHtml({
      scenes: [
        {
          id: "s1",
          templateId: "hf-opener",
          text: "Headline stays here.",
          emphasis: [],
        },
      ],
      timeline: [{ sceneId: "s1", startFrame: 0, durationFrames: 90 }],
      width: 1080,
      height: 1920,
      fps: 30,
      tokens: defaultBrandTokens,
      captions: {
        enabled: true,
        timingSource: "imported",
        cues: [
          {
            id: "cue-1",
            startFrame: 15,
            endFrame: 60,
            text: "Spoken <copy> is escaped.",
          },
        ],
      },
    });

    expect(html).toContain("rs-subtitle");
    expect(html).toContain('data-start="0.500"');
    expect(html).toContain('data-duration="1.500"');
    expect(html).toContain("Spoken &lt;copy&gt; is escaped.");
    expect(html).toContain("Headline stays here.");
    expect(html).toContain("syncSubtitles(t)");
  });

  it("serializes a versioned caption style and word timing clips", () => {
    const html = buildHyperframesCompositionHtml({
      scenes: [
        {
          id: "s1",
          templateId: "hf-opener",
          text: "Headline",
          emphasis: [],
        },
      ],
      timeline: [{ sceneId: "s1", startFrame: 0, durationFrames: 60 }],
      width: 1920,
      height: 1080,
      fps: 30,
      tokens: defaultBrandTokens,
      captions: {
        enabled: true,
        timingSource: "provider",
        style: CAPTION_STYLE_PRESETS.technical,
        cues: [
          {
            id: "cue",
            startFrame: 0,
            endFrame: 60,
            text: "Ship safely",
            words: [
              { text: "Ship", startFrame: 0, endFrame: 30 },
              { text: "safely", startFrame: 30, endFrame: 60 },
            ],
          },
        ],
      },
    });

    expect(html).toContain('data-caption-style="technical"');
    expect(html).toContain('data-caption-style-version="1"');
    expect(html).toContain("flex-direction:column");
    expect(html).toContain(
      'class="rs-caption-line" data-layout-allow-overlap data-layout-allow-occlusion',
    );
    expect(html).toContain("rs-caption-active");
    expect(html).toContain('data-start="1.000"');
    expect(html).toContain('data-duration="1.000"');
    expect(html).toContain('dir="auto"');
  });

  it("emits deterministic muted stock-video timing and cover layout", () => {
    const html = buildHyperframesCompositionHtml({
      scenes: [
        {
          id: "stock-video",
          templateId: "hf-opener",
          text: "Stock footage stays deterministic.",
          emphasis: [],
          background: {
            type: "video",
            url: "https://videos.example.test/clip.mp4?x=1&y=2",
            muted: false,
            stock: true,
          },
        },
      ],
      timeline: [
        { sceneId: "stock-video", startFrame: 30, durationFrames: 75 },
      ],
      width: 1080,
      height: 1920,
      fps: 30,
      tokens: defaultBrandTokens,
    });

    expect(html).toContain('id="scene-stock-video-stock-video"');
    expect(html).toContain(
      'src="https://videos.example.test/clip.mp4?x=1&amp;y=2"',
    );
    expect(html).toContain('data-start="1.000"');
    expect(html).toContain('data-duration="2.500"');
    expect(html).toContain('data-media-start="0"');
    expect(html).toContain('data-track-index="0"');
    expect(html).toContain("muted playsinline");
    const videoTag = html.match(
      /<video id="scene-stock-video-stock-video"[^>]+>/,
    )?.[0];
    expect(videoTag).toBeTruthy();
    expect(videoTag).toContain('data-start="1.000"');
    expect(videoTag).toContain('data-duration="2.500"');
    expect(videoTag).not.toContain("crossorigin");
    expect(html.indexOf(videoTag!)).toBeLessThan(
      html.indexOf('id="scene-stock-video"'),
    );
    expect(html).toContain(
      ".bg-video { width: 100%; height: 100%; object-fit: cover; }",
    );
    expect(html).not.toContain("<video loop");
  });

  it("serializes the shared fade, ducking, and SFX mix contract", () => {
    const html = buildHyperframesCompositionHtml({
      scenes: [
        {
          id: "s1",
          templateId: "hf-opener",
          text: "Audio stays clear.",
          emphasis: [],
        },
      ],
      timeline: [{ sceneId: "s1", startFrame: 30, durationFrames: 60 }],
      width: 1080,
      height: 1920,
      fps: 30,
      tokens: defaultBrandTokens,
      audioUrl: "/media/takes/voice.wav",
      musicUrl: "/music/tech-minimal.wav",
      musicVolume: 40,
      sfxCues: [{ url: "/sfx/pop.wav", startFrame: 45, volume: 0.3 }],
    });

    expect(html).toContain('data-role="voice"');
    expect(html).toContain('data-role="music"');
    expect(html).toContain('data-role="sfx"');
    expect(html).toContain('data-fade-in="11"');
    expect(html).toContain('"duckRatio":0.35');
    expect(html).toContain('"startFrame":30,"endFrame":90');
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

  it("supports a local motion runtime for offline producer renders", () => {
    const html = buildHyperframesCompositionHtml(
      {
        scenes: [
          {
            id: "hook",
            templateId: "hf-opener",
            text: "Local motion runtime.",
            emphasis: ["Local"],
          },
        ],
        timeline: [{ sceneId: "hook", startFrame: 0, durationFrames: 30 }],
        width: 1080,
        height: 1920,
        fps: 30,
        tokens: defaultBrandTokens,
      },
      {
        producerMode: true,
        runtimeUrl: "/_runtime/gsap.min.js",
      },
    );

    expect(html).toContain('src="/_runtime/gsap.min.js"');
    expect(html).toContain("data-reel-local-fonts");
    expect(html).toContain("/_runtime/geist-latin-wght-normal.woff2");
    expect(html).toContain("/_runtime/geist-mono-latin-wght-normal.woff2");
    expect(html).not.toContain("cdn.jsdelivr.net");
    expect(html).not.toContain("fonts.googleapis.com");
    expect(html).not.toContain("requestAnimationFrame");
  });

  it("renders only supplied chart values and attribution", () => {
    const html = buildHyperframesCompositionHtml({
      scenes: [
        {
          id: "chart",
          templateId: "hf-data-chart",
          text: "Activation rose after launch.",
          visual: "Activation by week",
          emphasis: [],
          chart: {
            labels: ["Week 1", "Week 2", "Week 3"],
            series: [{ label: "Activation", values: [42, 57, 63], unit: "%" }],
            sourceAttribution: "Source: audited product analytics",
          },
        },
      ],
      timeline: [{ sceneId: "chart", startFrame: 0, durationFrames: 90 }],
      width: 1080,
      height: 1920,
      fps: 30,
      tokens: defaultBrandTokens,
    });

    expect(html).toContain('data-catalog-block="data-chart"');
    expect(html).toContain("Week 1");
    expect(html).toContain("42%");
    expect(html).toContain("audited product analytics");
    expect(html).not.toContain("Monthly Revenue vs. Conversion Rate");
    expect(html).not.toContain("Internal analytics");
  });

  it("falls back to a statement when chart or metric inputs are missing", () => {
    const html = buildHyperframesCompositionHtml({
      scenes: [
        {
          id: "chart",
          templateId: "hf-data-chart",
          text: "Retention is improving without a verified data series.",
          emphasis: [],
        },
        {
          id: "money",
          templateId: "hf-money-count",
          text: "Customers are saving more time.",
          emphasis: [],
        },
      ],
      timeline: [
        { sceneId: "chart", startFrame: 0, durationFrames: 60 },
        { sceneId: "money", startFrame: 60, durationFrames: 60 },
      ],
      width: 1080,
      height: 1920,
      fps: 30,
      tokens: defaultBrandTokens,
    });

    expect(html).not.toContain('data-catalog-block="data-chart"');
    expect(html).not.toContain('data-catalog-block="apple-money-count"');
    expect(html).not.toContain("$10,000");
    expect(html).toContain("Retention");
    expect(html).toContain("Customers");
  });

  it("does not infer a website from a brand handle", () => {
    const html = buildHyperframesCompositionHtml({
      scenes: [
        {
          id: "outro",
          templateId: "hf-logo-outro",
          text: "Create your next release.",
          emphasis: [],
        },
      ],
      timeline: [{ sceneId: "outro", startFrame: 0, durationFrames: 60 }],
      width: 1080,
      height: 1920,
      fps: 30,
      tokens: { ...defaultBrandTokens, handle: "acme" },
    });

    expect(html).not.toContain("acme.com");
    expect(html).not.toContain("figma.com");
  });

  it.each(ORIENTATIONS)(
    "renders reviewed local-image carousels in %s preview and export markup",
    (orientation) => {
      const dimensions = dimsFor(orientation);
      const props = {
        scenes: [
          {
            id: `carousel-${orientation}`,
            templateId: "hf-carousel-circle-v1",
            text: "Your launch in three moments.",
            emphasis: ["three moments"],
            carouselImages: [
              "/media/first.png",
              "/media/second.png",
              "/media/third.png",
            ],
          },
        ],
        timeline: [
          {
            sceneId: `carousel-${orientation}`,
            startFrame: 0,
            durationFrames: 180,
          },
        ],
        ...dimensions,
        fps: 30,
        tokens: defaultBrandTokens,
        catalogRevision: CURRENT_HF_CATALOG_REVISION,
      };
      const preview = buildHyperframesCompositionHtml(props, {
        inlineCatalog: true,
      });
      const exported = buildHyperframesCompositionHtml(props, {
        producerMode: true,
        runtimeUrl: "/_runtime/gsap.min.js",
      });

      for (const html of [preview, exported]) {
        expect(html).toContain('data-catalog-block="carousel-circle-1"');
        expect(html.match(/data-carousel-card=/g)).toHaveLength(3);
        expect(html).toContain('src="/media/first.png"');
        expect(html).not.toContain("static.heygen.ai");
        expect(html).toContain("carouselCards.forEach");
      }
    },
  );

  it("requires supplied images and honors a saved catalog revision", () => {
    const base = {
      scenes: [
        {
          id: "carousel",
          templateId: "hf-carousel-vision-v1",
          text: "Saved gallery",
          emphasis: [],
          carouselImages: ["/a.png", "/b.png", "/c.png"],
        },
      ],
      timeline: [{ sceneId: "carousel", startFrame: 0, durationFrames: 180 }],
      width: 1080,
      height: 1920,
      fps: 30,
      tokens: defaultBrandTokens,
    };
    const current = buildHyperframesCompositionHtml({
      ...base,
      catalogRevision: CURRENT_HF_CATALOG_REVISION,
    });
    const retained = buildHyperframesCompositionHtml({
      ...base,
      catalogRevision: PREVIOUS_HF_CATALOG_REVISION,
    });
    const missingMedia = buildHyperframesCompositionHtml({
      ...base,
      scenes: [{ ...base.scenes[0], carouselImages: ["/a.png", "/b.png"] }],
      catalogRevision: CURRENT_HF_CATALOG_REVISION,
    });

    expect(current).toContain('data-catalog-block="carousel-vision-1"');
    expect(retained).not.toContain("data-carousel-card");
    expect(missingMedia).not.toContain("data-carousel-card");
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

  it("maps remotion picks by capability without rewriting scene positions", () => {
    const scenes = [
      { text: "Hook", templateId: "kinetic", emphasis: [] },
      { text: "Stat", templateId: "stat-reveal", emphasis: [], visual: "10x" },
      { text: "Bye", templateId: "emoji-punch", emphasis: [] },
    ] as AIScene[];
    const mapped = mapScenesToEngineTemplates(scenes, "hyperframes");
    expect(mapped.map((s) => s.templateId)).toEqual([
      "hf-kinetic-slam",
      "hf-money-count",
      "hf-kinetic-slam",
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

  it("escapes user values inserted into markup", () => {
    const attack = '</script><script data-owned="true">alert(1)</script>';
    const html = personalizeCatalogHtml("instagram-follow", {
      scene: { text: "Follow us", visual: attack, emphasis: [] },
      tokens: { ...defaultBrandTokens, handle: attack },
    });

    expect(html).not.toContain(attack);
    expect(html).not.toContain('<script data-owned="true">');
    expect(html).toContain("&lt;/script&gt;");
  });

  it("escapes kinetic words embedded in executable script", () => {
    const html = personalizeCatalogHtml("caption-kinetic-slam", {
      scene: {
        text: "Ship </script><script>alert(1)</script> safely",
        emphasis: [],
      },
      tokens: defaultBrandTokens,
    });

    expect(html).not.toContain("</script><script>alert(1)</script>");
    expect(html).toContain("Ship");
  });

  it("rejects data-bound catalog blocks without factual inputs", () => {
    expect(() =>
      personalizeCatalogHtml("data-chart", {
        scene: { text: "Revenue increased", emphasis: [] },
        tokens: defaultBrandTokens,
      }),
    ).toThrow("structured chart data");

    expect(() =>
      personalizeCatalogHtml("apple-money-count", {
        scene: { text: "Revenue increased", emphasis: [] },
        tokens: defaultBrandTokens,
      }),
    ).toThrow("explicit numeric visual");
  });
});
