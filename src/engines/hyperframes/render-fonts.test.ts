import { describe, expect, it } from "vitest";

import {
  HYPERFRAMES_RENDER_FONT_FILES,
  hyperframesBrandFont,
  localizeHyperframesRenderFonts,
} from "./render-fonts";

describe("localizeHyperframesRenderFonts", () => {
  it("removes remote font stylesheets and injects genuine bundled font families", () => {
    const html = `<!doctype html><html><head>
      <link rel="preconnect" href="https://fonts.gstatic.com">
      <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;700&display=swap" rel="stylesheet">
      <style>@import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono');</style>
    </head><body style="font-family: 'Inter'"></body></html>`;

    const localized = localizeHyperframesRenderFonts(html, "./runtime");

    expect(localized).not.toMatch(/fonts\.(?:googleapis|gstatic)\.com/);
    expect(localized).toContain("data-reel-local-fonts");
    expect(localized).toContain("font-family: 'Inter'");
    expect(localized).toContain("font-family: 'JetBrains Mono'");
    expect(localized).toContain(
      `./runtime/${HYPERFRAMES_RENDER_FONT_FILES.sans}`,
    );
    expect(localized).toContain(
      `./runtime/${HYPERFRAMES_RENDER_FONT_FILES.mono}`,
    );
  });

  it("prepends local styles when an HTML fragment has no head", () => {
    const localized = localizeHyperframesRenderFonts("<main>Scene</main>");

    expect(localized).toMatch(/^<style data-reel-local-fonts>/);
    expect(localized).toContain("<main>Scene</main>");
  });
});

it("normalizes legacy font declarations without changing authored copy or script symbols", () => {
  const html =
    '<style>.quote{font-family:"Instrument Serif",Georgia,serif}</style><p style="font-family: Impact">Georgia has Impact</p><script>const Impact = "Georgia";</script>';
  const result = localizeHyperframesRenderFonts(html);
  expect(result).toContain('font-family:"EB Garamond",EB Garamond,serif');
  expect(result).toContain('style="font-family: Archivo Black"');
  expect(result).toContain("Georgia has Impact");
  expect(result).toContain('const Impact = "Georgia"');
});

it("resolves legacy brand fonts and freezes unknown host-dependent faces", () => {
  expect(hyperframesBrandFont("DM Sans, Arial")).toBe("Inter");
  expect(hyperframesBrandFont("Georgia, serif")).toBe("EB Garamond");
  expect(hyperframesBrandFont("Missing Custom Font, Arial")).toBe("Geist");
});
