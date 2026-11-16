import { describe, expect, it } from "vitest";

import {
  DRAFT_RENDER_RATIO,
  describeJobProgress,
  estimateRemainingSeconds,
  formatRemaining,
  sceneAtFraction,
} from "./render-estimate";

describe("estimateRemainingSeconds", () => {
  it("starts from the draft benchmark", () => {
    expect(
      estimateRemainingSeconds({
        quality: "draft",
        videoSeconds: 45,
        progress: 0,
        elapsedSeconds: 5,
      }),
    ).toBeCloseTo(45 * DRAFT_RENDER_RATIO - 5);
  });

  it("does not guess for qualities the benchmark has not measured", () => {
    expect(
      estimateRemainingSeconds({
        quality: "standard",
        videoSeconds: 45,
        progress: 0.05,
        elapsedSeconds: 10,
      }),
    ).toBeNull();
  });

  it("switches to the observed pace once far enough along", () => {
    expect(
      estimateRemainingSeconds({
        quality: "standard",
        videoSeconds: 45,
        progress: 0.5,
        elapsedSeconds: 60,
      }),
    ).toBeCloseTo(60);
  });

  it("is zero when done", () => {
    expect(
      estimateRemainingSeconds({
        videoSeconds: 10,
        progress: 1,
        elapsedSeconds: 5,
      }),
    ).toBe(0);
  });
});

describe("formatRemaining", () => {
  it("words the estimate", () => {
    expect(formatRemaining(null)).toBeNull();
    expect(formatRemaining(4)).toBe("almost done");
    expect(formatRemaining(42)).toBe("about 40 s left");
    expect(formatRemaining(200)).toBe("about 3 min left");
  });
});

describe("sceneAtFraction", () => {
  it("maps render progress to a scene by length", () => {
    const lengths = [5, 5, 10];
    expect(sceneAtFraction(lengths, 0)).toEqual({ scene: 1, total: 3 });
    expect(sceneAtFraction(lengths, 0.3)).toEqual({ scene: 2, total: 3 });
    expect(sceneAtFraction(lengths, 0.9)).toEqual({ scene: 3, total: 3 });
    expect(sceneAtFraction(lengths, 1)).toEqual({ scene: 3, total: 3 });
    expect(sceneAtFraction([], 0.5)).toBeNull();
  });
});

describe("describeJobProgress", () => {
  it("names the scene being rendered and the time left", () => {
    expect(
      describeJobProgress({
        steps: [
          { key: "plan", state: "succeeded", progress: 1 },
          { key: "render_export", state: "running", progress: 0.5 },
        ],
        progress: 0.6,
        sceneSeconds: [5, 5, 10],
        quality: "draft",
        elapsedSeconds: 20,
      }),
    ).toBe("Rendering scene 3 of 3 · about 15 s left");
  });

  it("names earlier stages without a scene", () => {
    expect(
      describeJobProgress({
        steps: [{ key: "synthesize_audio", state: "running", progress: 0.2 }],
        progress: 0.1,
        sceneSeconds: [],
        elapsedSeconds: 3,
      }),
    ).toBe("Recording the narration");
  });
});
