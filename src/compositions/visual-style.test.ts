import { describe, expect, it } from "vitest";

import {
  DEFAULT_ENERGY_ID,
  DEFAULT_STYLE_ID,
  getMotionRecipe,
  getStyleChrome,
  getTransitionFrames,
  normalizeEnergyId,
  normalizeStyleId,
} from "./visual-style";
import { resolvePlanVisualStyle } from "@/library/enrich-scene-plan";
import { treatmentTokens } from "./components/background-treatments";
import { defaultBrandTokens } from "./tokens";

describe("visual-style", () => {
  it("defaults unknown ids to bold-hook / normal", () => {
    expect(normalizeStyleId("nope")).toBe(DEFAULT_STYLE_ID);
    expect(normalizeEnergyId(undefined)).toBe(DEFAULT_ENERGY_ID);
  });

  it("high energy is snappier than calm", () => {
    const calm = getMotionRecipe("bold-hook", "calm");
    const high = getMotionRecipe("bold-hook", "high");
    expect(high.stiffness).toBeGreaterThan(calm.stiffness);
    expect(high.stagger).toBeLessThan(calm.stagger);
    expect(getTransitionFrames("bold-hook", "high")).toBeLessThan(
      getTransitionFrames("bold-hook", "calm"),
    );
  });

  it("clean-story prefers hiding the progress bar", () => {
    expect(getStyleChrome("clean-story").preferHideProgressBar).toBe(true);
    expect(getStyleChrome("bold-hook").preferHideProgressBar).toBe(false);
  });
});

describe("resolvePlanVisualStyle", () => {
  it("UI locks override the model plan", () => {
    expect(
      resolvePlanVisualStyle(
        { styleId: "soft-brand", energy: "calm" },
        { styleId: "teach-me", energy: "high" },
      ),
    ).toEqual({ styleId: "teach-me", energy: "high" });
  });

  it("auto uses the plan values", () => {
    expect(
      resolvePlanVisualStyle(
        { styleId: "clean-story", energy: "calm" },
        { styleId: "auto", energy: "auto" },
      ),
    ).toEqual({ styleId: "clean-story", energy: "calm" });
  });
});

describe("treatmentTokens", () => {
  it("tints brand colors instead of fully replacing them", () => {
    const tinted = treatmentTokens(defaultBrandTokens, "tech", 0);
    expect(tinted.accent.toLowerCase()).not.toBe(defaultBrandTokens.accent.toLowerCase());
    expect(tinted.accent.toLowerCase()).not.toBe("#22d3ee");
    expect(tinted.handle).toBe(defaultBrandTokens.handle);
  });
});
