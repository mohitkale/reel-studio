import { describe, expect, it } from "vitest";

import {
  buildThumbnailHtml,
  THUMBNAIL_SIZES,
  thumbnailFontSize,
} from "@/lib/thumbnail-html";

describe("thumbnail page", () => {
  it("has the two sizes the issue asks for", () => {
    expect(THUMBNAIL_SIZES.landscape).toEqual({ width: 1280, height: 720 });
    expect(THUMBNAIL_SIZES.vertical).toEqual({ width: 1080, height: 1920 });
  });

  it("escapes the words and never lets markup through", () => {
    const html = buildThumbnailHtml({
      text: '<script>alert(1)</script> "&"',
      size: "landscape",
    });
    expect(html).not.toContain("<script>alert");
    expect(html).toContain("&lt;script&gt;");
    expect(html).toContain("&quot;&amp;&quot;");
  });

  it("uses the palette, ignoring anything that is not a plain colour", () => {
    const ok = buildThumbnailHtml({
      text: "Hi",
      size: "landscape",
      palette: { accent: "#ff0000" },
    });
    expect(ok).toContain("#ff0000");
    const bad = buildThumbnailHtml({
      text: "Hi",
      size: "landscape",
      palette: { accent: "red;}body{display:none" },
    });
    expect(bad).not.toContain("display:none");
  });

  it("only accepts a data URL image as the picture", () => {
    const good = buildThumbnailHtml({
      text: "Hi",
      size: "landscape",
      frameDataUrl: "data:image/jpeg;base64,AAAA",
    });
    expect(good).toContain('url("data:image/jpeg;base64,AAAA")');
    const bad = buildThumbnailHtml({
      text: "Hi",
      size: "landscape",
      frameDataUrl: "https://evil.example/x.png",
    });
    expect(bad).not.toContain("evil.example");
  });

  it("makes longer text smaller, and is deterministic", () => {
    expect(thumbnailFontSize("Hi", "landscape")).toBeGreaterThan(
      thumbnailFontSize("Why is the sky blue every single day?", "landscape"),
    );
    const input = { text: "Why blue?", size: "vertical" as const };
    expect(buildThumbnailHtml(input)).toBe(buildThumbnailHtml(input));
  });
});
