import { describe, expect, it } from "vitest";

import { defaultBrandTokens } from "@/compositions/tokens";
import { CAPTION_STYLE_PRESETS } from "@/lib/caption-style";
import {
  resolveCaptionRenderStyle,
  splitCaptionText,
} from "@/lib/caption-render";
import { resolveProductionLayout } from "@/production/layout";

describe("shared caption render measurements", () => {
  it.each([
    [1080, 1920, "portrait"],
    [1920, 1080, "landscape"],
    [1080, 1080, "square"],
  ] as const)(
    "resolves safe placement for %sx%s",
    (width, height, expected) => {
      const layout = resolveProductionLayout({ width, height });
      const resolved = resolveCaptionRenderStyle({
        style: CAPTION_STYLE_PRESETS.karaoke,
        tokens: defaultBrandTokens,
        layout,
      });
      expect(layout.orientation).toBe(expected);
      expect(resolved.outer.paddingLeft).toBeGreaterThanOrEqual(
        layout.safeArea.left,
      );
      expect(resolved.outer.paddingBottom).toBeGreaterThanOrEqual(
        layout.captionBottom,
      );
      expect(resolved.inner.maxWidth).toBe(layout.captionMaxWidth);
    },
  );

  it("wraps Unicode and RTL text without dropping content", () => {
    const text = "Hello दुनिया مرحبا بالعالم caption text";
    const lines = splitCaptionText(text, 3);
    expect(lines).toEqual(["Hello दुनिया مرحبا", "بالعالم caption text"]);
    expect(lines.join(" ")).toBe(text);
  });
});
