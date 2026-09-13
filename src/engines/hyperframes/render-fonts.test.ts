import { describe, expect, it } from "vitest";

import {
  HYPERFRAMES_RENDER_FONT_FILES,
  localizeHyperframesRenderFonts,
} from "./render-fonts";

describe("localizeHyperframesRenderFonts", () => {
  it("removes remote font stylesheets and injects local family aliases", () => {
    const html = `<!doctype html><html><head>
      <link rel="preconnect" href="https://fonts.gstatic.com">
      <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;700&display=swap" rel="stylesheet">
      <style>@import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono');</style>
    </head><body style="font-family: 'Inter'"></body></html>`;

    const localized = localizeHyperframesRenderFonts(html, "./runtime");

    expect(localized).not.toMatch(/fonts\.(?:googleapis|gstatic)\.com/);
    expect(localized).toContain("data-reel-local-fonts");
    expect(localized).toContain('font-family:"Inter"');
    expect(localized).toContain('font-family:"JetBrains Mono"');
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
