import { describe, expect, it } from "vitest";

import { createDeterministicProductionPlan } from "./manual-planner";
import { fitDisplayCopy } from "./display-copy";

describe("fitDisplayCopy", () => {
  it("keeps copy that fits, untouched", () => {
    expect(fitDisplayCopy("Sleep is a skill you can practise.")).toEqual({
      text: "Sleep is a skill you can practise.",
      shortened: false,
    });
  });

  it("shortens a long line to its first complete sentence", () => {
    const text =
      "Most habits fail because they ask too much too soon. Start smaller than feels useful and let the routine earn its place over time.";
    expect(fitDisplayCopy(text)).toEqual({
      text: "Most habits fail because they ask too much too soon.",
      shortened: true,
    });
  });

  it("shortens at a clause boundary, never mid-phrase and never with an ellipsis", () => {
    const text =
      "A strong explainer begins with one clear idea, a promise to the viewer, and a reason to keep watching until the very end of the video today.";
    const result = fitDisplayCopy(text);
    expect(result.shortened).toBe(true);
    expect(result.text).not.toMatch(/[…]|\.\.\.$/);
    expect(text.startsWith(result.text)).toBe(true);
    expect(text.charAt(result.text.length)).toMatch(/[,;:]/);
  });

  it("keeps the whole line when no complete part fits, instead of cutting it", () => {
    const text =
      "one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen seventeen eighteen nineteen twenty";
    expect(fitDisplayCopy(text)).toEqual({ text, shortened: false });
  });
});

describe("deterministic planner copy", () => {
  it("never produces an ellipsis or a mid-clause cut", () => {
    const plan = createDeterministicProductionPlan({
      name: "T",
      text: "A strong explainer begins with one clear idea, a promise to the viewer, and a reason to keep watching until the very end of the video today.\n\nWe tested the new layout with forty five creators across three formats, and every single one of them preferred the version with larger type and fewer words on screen.",
      presetId: "editorial-explainer",
      videoEngine: "hyperframes",
      hasVisualAsset: false,
    });
    for (const scene of plan.plan.scenes) {
      expect(scene.text).not.toMatch(/[…]|\.\.\.$/);
      if (scene.spokenText && scene.text !== scene.spokenText) {
        expect(scene.spokenText.startsWith(scene.text)).toBe(true);
      }
    }
  });
});
