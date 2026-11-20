import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";

import { injectDeterministicFontFaces } from "@hyperframes/producer";
import { describe, expect, it } from "vitest";

import { buildHyperframesCompositionHtml } from "@/engines/hyperframes/build-composition";
import { localizeHyperframesRenderFonts } from "@/engines/hyperframes/render-fonts";
import { storyboardToReelProps } from "@/production/storyboard-reel";
import { THEMES } from "@/video/themes";
import { lintStoryboard } from "@/storyboard/lint";

const SIZES = {
  "16:9": [1920, 1080],
  "9:16": [1080, 1920],
  "1:1": [1080, 1080],
} as const;

describe("fonts in a render are local (#233)", () => {
  it("rewrites families named in custom properties, not only font-family", () => {
    const html = localizeHyperframesRenderFonts(
      `<html><head><style>:root{--theme-heading-font:'Archivo Black', Impact, sans-serif;--body-font:'EB Garamond', Georgia, "Times New Roman", serif}</style></head><body></body></html>`,
    );
    const css = html.match(/--theme-heading-font:[^;}]*/)?.[0] ?? "";
    expect(css).not.toContain("Impact");
    expect(html).not.toMatch(/--body-font:[^;}]*(Georgia|Times New Roman)/);
  });

  it("makes no font request for any golden example or theme (the compiler's own font pass)", async () => {
    const dir = path.join(process.cwd(), "examples", "storyboards");
    const read = (file: string) =>
      JSON.parse(readFileSync(path.join(dir, file), "utf8"));
    const cases: Array<[string, Record<string, unknown>]> = [];
    for (const file of readdirSync(dir).filter((f) => f.endsWith(".json"))) {
      const raw = read(file);
      if (raw.kind !== "podcast") cases.push([file, raw]);
    }
    // Every look on one landscape and one portrait example.
    for (const theme of THEMES)
      for (const file of ["explainer.json", "story.json"])
        cases.push([
          `${file} as ${theme.id}`,
          { ...read(file), theme: theme.id },
        ]);

    const requested: Record<string, string[]> = {};
    for (const [name, raw] of cases) {
      const storyboard = lintStoryboard(raw).storyboard;
      if (!storyboard || storyboard.kind !== "video")
        throw new Error(`${name} is not a video storyboard`);
      const [width, height] = SIZES[storyboard.format as keyof typeof SIZES];
      const html = buildHyperframesCompositionHtml(
        { ...storyboardToReelProps(storyboard).props, width, height },
        { producerMode: true },
      );
      const urls: string[] = [];
      await injectDeterministicFontFaces(html, {
        fetchImpl: async (url) => {
          urls.push(String(url));
          return new Response("", { status: 404 });
        },
        fontFetchRetryPolicy: {
          maxAttempts: 1,
          attemptTimeoutMs: 1000,
          maxElapsedMs: 1000,
          baseDelayMs: 0,
        },
        allowSystemFontCapture: false,
      }).catch(() => undefined);
      if (urls.length) requested[name] = urls.map(decodeURIComponent);
    }
    expect(requested).toEqual({});
  }, 180_000);
});
