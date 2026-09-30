import { describe, expect, it } from "vitest";
import { planVisualReview, visualReviewRequestSchema } from "./visual-review";

const timeline = [
  { sceneId: "a", startFrame: 0, durationFrames: 90 },
  { sceneId: "b", startFrame: 90, durationFrames: 60 },
];
describe("visual review frames", () => {
  it("samples playback order, uses cover offsets and never samples the next scene", () => {
    const points = planVisualReview(timeline, ["b", "a"], 4, 30);
    expect(points.map((point) => point.frame)).toEqual([
      39, 61, 88, 111, 126, 141, 159, 174,
    ]);
    expect(points[4]).toMatchObject({
      sceneId: "b",
      sceneNumber: 2,
      label: "Opening",
    });
    expect(planVisualReview(timeline, ["b"], 1, 30)[0].frame).toBe(159);
  });
  it("deduplicates tiny scenes and reports missing or empty scenes", () => {
    expect(
      planVisualReview(
        [{ sceneId: "a", startFrame: 0, durationFrames: 1 }],
        ["a"],
        4,
      ),
    ).toHaveLength(1);
    expect(() => planVisualReview(timeline, ["removed"], 1)).toThrow(
      "no longer exists",
    );
    expect(() =>
      planVisualReview(
        [{ sceneId: "a", startFrame: 0, durationFrames: 0 }],
        ["a"],
        1,
      ),
    ).toThrow("empty scene");
  });
  it("bounds compute and rejects duplicate IDs, unknown fields and arbitrary times", () => {
    expect(visualReviewRequestSchema.parse({ sceneIds: ["a"] }).samples).toBe(
      1,
    );
    for (const request of [
      { sceneIds: [] },
      { sceneIds: ["a", "a"] },
      { sceneIds: ["a", "b", "c"], samples: 4 },
      { sceneIds: ["a"], frame: 42 },
      { sceneIds: ["a"], samples: 8 },
      { sceneIds: Array.from({ length: 9 }, (_, index) => String(index)) },
    ])
      expect(visualReviewRequestSchema.safeParse(request).success).toBe(false);
  });
});
