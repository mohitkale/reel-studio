import { describe, expect, it } from "vitest";
import { assertVideoDuration, videoDurationLimit } from "./limits";
import { chapterPlanSchema } from "./chapters";

const scenes = Array.from({ length: 24 }, (_, index) => ({ id: `s${index}` }));
const chapterPlan = chapterPlanSchema.parse({
  version: "1.0.0",
  chapters: [
    { id: "a", title: "Opening", firstSceneId: "s0" },
    { id: "b", title: "Payoff", firstSceneId: "s12" },
  ],
});

describe("chapter video duration policy", () => {
  it("requires supported frame rate and valid saved boundaries for higher duration", () => {
    expect(videoDurationLimit({ fps: 30, scenes, chapterPlan })).toBe(300);
    expect(videoDurationLimit({ fps: 30, scenes })).toBe(180);
    expect(videoDurationLimit({ fps: 25, scenes, chapterPlan })).toBe(180);
    expect(
      videoDurationLimit({ fps: 30, scenes: scenes.slice(1), chapterPlan }),
    ).toBe(180);
    expect(
      videoDurationLimit({
        fps: 30,
        scenes,
        chapterPlan: {
          ...chapterPlan,
          chapters: chapterPlan.chapters.slice(0, 1),
        },
      }),
    ).toBe(180);
  });
  it("enforces the exact complete frame range, including cover and token policy", () => {
    expect(() => assertVideoDuration(9000, 30, 300)).not.toThrow();
    expect(() => assertVideoDuration(9001, 30, 300)).toThrow(
      /including its cover/,
    );
    expect(() => assertVideoDuration(5401, 30, 180)).toThrow(/180 seconds/);
    expect(() => assertVideoDuration(1, 30, Number.NaN)).toThrow(/policy/);
    expect(() => assertVideoDuration(0, 30, 300)).toThrow(/frame timing/);
  });
});
