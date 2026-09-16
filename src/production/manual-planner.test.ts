import { describe, expect, it } from "vitest";

import {
  createDeterministicProductionPlan,
  segmentSourceText,
} from "@/production/manual-planner";

describe("deterministic production planning", () => {
  it("preserves all supplied narration while splitting long copy into bounded scenes", () => {
    const source = Array.from(
      { length: 80 },
      (_, index) =>
        `Sentence ${index + 1} contains supplied wording and detail.`,
    ).join(" ");
    const segments = segmentSourceText(source);

    expect(segments.length).toBeGreaterThan(1);
    expect(segments.length).toBeLessThanOrEqual(20);
    expect(segments.join(" ")).toBe(source);
  });

  it("caps long medium-sentence sources at the scene schema limit", () => {
    const source = Array.from(
      { length: 35 },
      (_, index) =>
        `Section ${index + 1} ${"carefully calibrated decision ".repeat(10).trim()}.`,
    ).join(" ");
    const segments = segmentSourceText(source);

    expect(segments).toHaveLength(20);
    expect(segments.join(" ")).toBe(source);
  });

  it("keeps long display copy separate from complete narration", () => {
    const sentence =
      "A production workflow should retain every supplied word while presenting concise and readable on-screen copy for viewers who are watching on a small phone display.";
    const source = Array.from({ length: 5 }, () => sentence).join(" ");
    const result = createDeterministicProductionPlan({
      name: "Readable launch",
      text: source,
      presetId: "product-launch",
      videoEngine: "hyperframes",
      hasVisualAsset: true,
    });

    expect(result.plan.scenes[0]?.text.endsWith("…")).toBe(true);
    expect(
      result.plan.scenes
        .map((scene) => scene.spokenText ?? scene.text)
        .join(" "),
    ).toBe(source);
    expect(result.warnings).toHaveLength(1);
    expect(result.roles).toContain("screenshot-demo");
    expect(
      result.plan.scenes.every((scene) => scene.templateId.startsWith("hf-")),
    ).toBe(true);
  });

  it("uses a non-data role when prose has no structured chart values", () => {
    const result = createDeterministicProductionPlan({
      name: "Plain-language finding",
      text: "The supplied research explains a pattern without providing a labeled dataset for a chart.",
      presetId: "data-story",
      videoEngine: "remotion",
      hasVisualAsset: false,
    });

    expect(result.roles).toEqual(["takeaway"]);
    expect(result.plan.scenes[0]?.chart).toBeUndefined();
  });

  it("does not assign media-dependent roles when no visual asset was supplied", () => {
    const result = createDeterministicProductionPlan({
      name: "Product notes",
      text: "Introduce the product clearly. Explain its useful workflow. End with a direct next step.",
      presetId: "product-launch",
      videoEngine: "hyperframes",
      hasVisualAsset: false,
    });

    expect(result.roles).not.toContain("screenshot-demo");
  });
});
