import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { SubtitleOverlay } from "@/compositions/components/subtitle-overlay";
import { defaultBrandTokens } from "@/compositions/tokens";
import type { ReelProps } from "@/compositions/types";
import { buildHyperframesCompositionHtml } from "@/engines/hyperframes/build-composition";
import { CAPTION_STYLE_PRESETS } from "@/lib/caption-style";
import { resolveCaptionRenderStyle } from "@/lib/caption-render";
import { resolveProductionLayout } from "@/production/layout";

const remotion = vi.hoisted(() => ({ frame: 15 }));
vi.mock("remotion", () => ({
  AbsoluteFill: "div",
  useCurrentFrame: () => remotion.frame,
}));

const cue = {
  id: "unicode-cue",
  startFrame: 0,
  endFrame: 60,
  text: "Hello दुनिया مرحبا supercalifragilisticexpialidocious",
  words: [
    { text: "Hello", startFrame: 0, endFrame: 15 },
    { text: "दुनिया", startFrame: 15, endFrame: 30 },
    { text: "مرحبا", startFrame: 30, endFrame: 45 },
    {
      text: "supercalifragilisticexpialidocious",
      startFrame: 45,
      endFrame: 60,
    },
  ],
};

function captions(): NonNullable<ReelProps["captions"]> {
  return {
    enabled: true,
    timingSource: "provider",
    style: {
      ...CAPTION_STYLE_PRESETS.karaoke,
      safeAreaOffsets: {
        portrait: { top: 0.01, right: 0.01, bottom: 0.02, left: 0.01 },
        landscape: { top: 0.02, right: 0.02, bottom: 0.01, left: 0.02 },
        square: { top: 0.01, right: 0.02, bottom: 0.01, left: 0.02 },
      },
    },
    cues: [cue],
  };
}

describe("caption engine parity", () => {
  it.each([
    [1080, 1920],
    [1920, 1080],
    [1080, 1080],
  ] as const)(
    "uses shared safe-area and type measurements at %sx%s",
    (width, height) => {
      const layout = resolveProductionLayout({ width, height });
      const captionTrack = captions();
      const resolved = resolveCaptionRenderStyle({
        style: captionTrack.style,
        tokens: defaultBrandTokens,
        layout,
      });
      const remotionMarkup = renderToStaticMarkup(
        <SubtitleOverlay
          captions={captionTrack}
          tokens={defaultBrandTokens}
          layout={layout}
        />,
      );
      const hyperframesHtml = buildHyperframesCompositionHtml({
        scenes: [
          {
            id: "scene",
            templateId: "hf-opener",
            text: "Scene headline",
            emphasis: [],
          },
        ],
        timeline: [{ sceneId: "scene", startFrame: 0, durationFrames: 60 }],
        captions: captionTrack,
        tokens: defaultBrandTokens,
        width,
        height,
        fps: 30,
        layout,
      });

      for (const padding of Object.values(resolved.outer)) {
        if (typeof padding === "number") {
          expect(remotionMarkup).toContain(`${padding}px`);
          expect(hyperframesHtml).toContain(`${padding}px`);
        }
      }
      expect(remotionMarkup).toContain(
        `data-caption-style-version="${resolved.style.version}"`,
      );
      expect(hyperframesHtml).toContain(
        `data-caption-style-version="${resolved.style.version}"`,
      );
      expect(remotionMarkup).toContain(
        `font-size:${resolved.inner.fontSize}px`,
      );
      expect(hyperframesHtml).toContain(
        `font-size:${resolved.inner.fontSize}px`,
      );
    },
  );

  it("preserves Unicode, RTL, long words, and karaoke frame boundaries", () => {
    const layout = resolveProductionLayout({ width: 1080, height: 1920 });
    const captionTrack = captions();
    const markup = renderToStaticMarkup(
      <SubtitleOverlay
        captions={captionTrack}
        tokens={defaultBrandTokens}
        layout={layout}
      />,
    );
    const html = buildHyperframesCompositionHtml({
      scenes: [
        {
          id: "scene",
          templateId: "hf-opener",
          text: "Scene headline",
          emphasis: [],
        },
      ],
      timeline: [{ sceneId: "scene", startFrame: 0, durationFrames: 60 }],
      captions: captionTrack,
      tokens: defaultBrandTokens,
      width: 1080,
      height: 1920,
      fps: 30,
      layout,
    });

    expect(markup).toContain('dir="auto"');
    expect(markup).toContain("Hello");
    expect(markup).toContain("दुनिया");
    expect(markup).toContain("مرحبا");
    expect(markup).toContain("supercalifragilisticexpialidocious");
    expect(markup).toContain("overflow-wrap:anywhere");
    expect(markup).toContain(`color:${captionTrack.style!.activeWordColor}`);

    expect(html).toContain('dir="auto"');
    expect(html).toContain("दुनिया");
    expect(html).toContain("مرحبا");
    expect(html).toContain("supercalifragilisticexpialidocious");
    expect(html).toContain("overflow-wrap:anywhere");
    expect(html).toContain('data-start="0.500"');
    expect(html).toContain('data-duration="1.500"');
    expect(html).toContain("syncSubtitles(t)");
  });
});
