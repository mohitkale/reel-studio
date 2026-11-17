import { describe, expect, it } from "vitest";

import { applyChanges, ChangeError, reviewStoryboard } from "./review";

const scene = (
  type: string,
  headline: string,
  narration = "Short narration for this scene.",
) => ({
  type,
  headline,
  narration,
});
const poor = {
  version: 1,
  title: "Poor",
  scenes: [
    scene(
      "list",
      "A very long headline that keeps going on and on far past what fits",
    ),
    scene("list", "Second", "word ".repeat(60)),
    scene("list", "Third"),
    scene("list", "Third"),
  ],
};

describe("reviewStoryboard", () => {
  it("phrases each finding as the edit that fixes it", () => {
    const { findings } = reviewStoryboard(poor);
    const by = (rule: string) => findings.filter((f) => f.rule === rule);
    expect(by("long-headline")[0]!.suggestion).toMatch(
      /scene 1: the headline is \d+ words; shorten it to 7/,
    );
    expect(by("long-narration")[0]!.suggestion).toMatch(
      /scene 2: .*split it into two scenes/,
    );
    expect(by("repeated-type").map((f) => f.scene)).toEqual([3, 4]);
    expect(by("no-hook")).toHaveLength(1);
    expect(by("no-close")).toHaveLength(1);
    expect(by("duplicate-headline")[0]!.suggestion).toContain(
      "repeats scene 3",
    );
  });

  it("reports pacing per scene and in total", () => {
    const review = reviewStoryboard(poor);
    expect(review.pacing).toHaveLength(4);
    expect(review.pacing[1]!.seconds).toBeGreaterThan(20);
    expect(review.totalSeconds).toBeGreaterThan(24);
  });

  it("has nothing to say about a tidy storyboard", () => {
    const tidy = {
      version: 1,
      title: "Tidy",
      scenes: [
        scene("hook", "Why the sky is blue"),
        scene("statement", "Light scatters"),
        scene("stat", "Blue scatters most"),
        scene("cta", "Look up today"),
      ],
    };
    expect(reviewStoryboard(tidy).findings.filter((f) => f.scene > 0)).toEqual(
      [],
    );
  });
});

describe("applyChanges", () => {
  const base = {
    scenes: [scene("hook", "A"), scene("statement", "B"), scene("cta", "C")],
  };

  it("replaces, updates, inserts, removes and moves, counting from 1", () => {
    const out = applyChanges(
      base,
      [
        { op: "update", index: 2, fields: { headline: "B2" } },
        { op: "insert", index: 2, scene: scene("stat", "S") },
        { op: "remove", index: 4 },
        { op: "move", from: 1, to: 3 },
      ],
      { title: "New" },
    );
    expect(out.scenes!.map((s) => s.headline)).toEqual(["S", "B2", "A"]);
    expect(out.title).toBe("New");
  });

  it("leaves the original untouched", () => {
    applyChanges(base, [{ op: "remove", index: 1 }]);
    expect(base.scenes).toHaveLength(3);
  });

  it("says which scene number was out of range", () => {
    expect(() => applyChanges(base, [{ op: "remove", index: 9 }])).toThrow(
      ChangeError,
    );
    expect(() => applyChanges(base, [{ op: "remove", index: 0 }])).toThrow(
      /out of range/,
    );
  });
});

describe("one review and one revision", () => {
  it("removes every finding on a deliberately poor storyboard", () => {
    const poorish = {
      version: 1,
      title: "Poor",
      scenes: [
        scene(
          "list",
          "A very long headline that keeps going on and on far past what fits",
          "Short.",
        ),
        scene("list", "Second", "word ".repeat(60)),
        scene("list", "Third"),
        scene("list", "Third"),
      ],
    };
    const before = reviewStoryboard(poorish).findings.filter(
      (f) => f.scene > 0,
    );
    expect(before.length).toBeGreaterThanOrEqual(5);
    const revised = applyChanges(poorish, [
      {
        op: "update",
        index: 1,
        fields: { type: "hook", headline: "Why this matters" },
      },
      {
        op: "update",
        index: 2,
        fields: {
          type: "statement",
          narration: "A shorter explanation of the idea.",
        },
      },
      {
        op: "update",
        index: 3,
        fields: { type: "stat", headline: "One number to remember" },
      },
      {
        op: "update",
        index: 4,
        fields: { type: "cta", headline: "Try it today" },
      },
    ]);
    expect(
      reviewStoryboard(revised).findings.filter((f) => f.scene > 0),
    ).toEqual([]);
  });
});
