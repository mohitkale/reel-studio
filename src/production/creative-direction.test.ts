import { describe, expect, it } from "vitest";
import {
  applyVisualTheme,
  resolveCreativeDirection,
  VISUAL_THEMES,
} from "./creative-direction";
import { defaultBrandTokens } from "@/video/tokens";
import { colorContrast } from "@/video/readable-palette";

describe("content-led visual direction", () => {
  it.each([
    [
      "Your 2027 Wheel of the Year and Moon Calendar",
      "editorial-explainer",
      "celestial",
    ],
    [
      "Explain how to create a mindful breathing habit.",
      "editorial-explainer",
      "botanical",
    ],
    ["Demonstrate debugging a TypeScript API.", "developer-demo", "circuit"],
    [
      "Explain the shift from AI to situational intelligence.",
      "editorial-explainer",
      "circuit",
    ],
    [
      "Introduce a meeting notes app and its three features.",
      "product-launch",
      "studio",
    ],
    [
      "A cinematic story about artisan craftsmanship.",
      "cinematic-brand",
      "ember",
    ],
    ["A punchy workout challenge.", "creator-punch", "signal"],
    [
      "Explain why reading a little each day helps.",
      "editorial-explainer",
      "paper",
    ],
    [
      "Supplied results:\nDraft: 42%\nReview: 68%\nRelease: 91%",
      "data-story",
      "circuit",
    ],
  ])("matches %s without random changes", (brief, presetId, id) => {
    const direction = resolveCreativeDirection(brief);
    expect(direction.presetId).toBe(presetId);
    expect(direction.theme.id).toBe(id);
    expect(resolveCreativeDirection(brief)).toEqual(direction);
  });
  it("preserves an explicit preset and does not match partial keywords", () => {
    expect(
      resolveCreativeDirection("Explain API debugging", "cinematic-brand")
        .presetId,
    ).toBe("cinematic-brand");
    expect(
      resolveCreativeDirection("Something happens each day.").theme.id,
    ).toBe("paper");
  });
  it("keeps identity and fonts while applying readable palettes", () => {
    for (const theme of Object.values(VISUAL_THEMES)) {
      const tokens = applyVisualTheme(
        { ...defaultBrandTokens, handle: "@mybrand" },
        theme,
      );
      expect(tokens.handle).toBe("@mybrand");
      expect(tokens.fontFamily).toBe(defaultBrandTokens.fontFamily);
      expect(
        colorContrast(tokens.foreground, tokens.background),
      ).toBeGreaterThanOrEqual(4.5);
      expect(
        colorContrast(tokens.muted, tokens.background),
      ).toBeGreaterThanOrEqual(4.5);
      expect(
        colorContrast(tokens.accentForeground, tokens.accent),
      ).toBeGreaterThanOrEqual(4.5);
    }
  });
});
