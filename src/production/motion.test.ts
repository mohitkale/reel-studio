import { describe, expect, it } from "vitest";

import {
  chooseTypeMotion,
  chooseSceneMotion,
  motionDirection,
  motionDirectionSchema,
  motionBarScaleMax,
  motionSpotlightFraction,
  resolveMotionDirection,
} from "@/production/motion";

describe("type motion direction", () => {
  it("chooses a readable recipe from the scene's role and copy", () => {
    const hook = chooseTypeMotion({ role: "hook", text: "A sharper opening." });
    expect(hook).toEqual(motionDirection("type-impact"));
    expect(
      chooseTypeMotion({ role: "headline", text: "A quieter opening." }),
    ).toEqual(motionDirection("type-editorial"));
    expect(
      chooseTypeMotion({ role: "chart", text: "Real values" }),
    ).toBeUndefined();
    expect(
      chooseTypeMotion({
        role: "hook",
        text: "Keep the supplied screenshot visible.",
        hasVisualContent: true,
      }),
    ).toBeUndefined();
    expect(
      chooseTypeMotion({
        role: "hook",
        text: "A sharper opening.",
        previous: hook,
      }),
    ).toEqual(motionDirection("type-editorial"));
  });

  it("keeps saved selections versioned and falls back when copy outgrows them", () => {
    expect(
      motionDirectionSchema.safeParse(motionDirection("type-impact")).success,
    ).toBe(true);
    expect(
      motionDirectionSchema.safeParse({
        recipeId: "type-impact",
        version: "9.0.0",
      }).success,
    ).toBe(false);
    expect(
      resolveMotionDirection(motionDirection("type-impact"), "x".repeat(121)),
    ).toBeUndefined();
    expect(
      resolveMotionDirection(
        motionDirection("type-editorial"),
        "x".repeat(121),
      ),
    ).toEqual(motionDirection("type-editorial"));
  });

  it("selects data treatments only from supplied, displayable values", () => {
    const single = {
      labels: ["Completion"],
      series: [{ label: "Survey", values: [72], unit: "%" }],
      sourceAttribution: "Creator survey",
    };
    expect(
      chooseSceneMotion({
        role: "metric",
        text: "Completion rose",
        chart: single,
      }),
    ).toEqual(motionDirection("data-spotlight"));
    expect(
      chooseSceneMotion({
        role: "metric",
        text: "Completion rose",
        chart: single,
        current: motionDirection("data-spotlight"),
      }),
    ).toEqual(motionDirection("data-spotlight"));
    expect(
      resolveMotionDirection(
        motionDirection("data-spotlight"),
        "Completion rose",
        single,
      ),
    ).toEqual(motionDirection("data-spotlight"));

    const comparison = {
      ...single,
      labels: ["Before", "After"],
      series: [{ label: "Survey", values: [32, 72], unit: "%" }],
    };
    expect(
      chooseSceneMotion({
        role: "chart",
        text: "Completion rose",
        chart: comparison,
      }),
    ).toEqual(motionDirection("data-bars"));
    expect(
      resolveMotionDirection(
        motionDirection("data-spotlight"),
        "Completion rose",
        comparison,
      ),
    ).toBeUndefined();
    expect(
      resolveMotionDirection(
        motionDirection("type-impact"),
        "Completion rose",
        comparison,
      ),
    ).toBeUndefined();
    expect(
      resolveMotionDirection(
        motionDirection("data-bars"),
        "Completion rose",
        comparison,
        true,
      ),
    ).toBeUndefined();
    expect(
      chooseSceneMotion({
        role: "chart",
        text: "Unsupported negatives",
        chart: {
          ...comparison,
          series: [{ label: "Survey", values: [-32, 72], unit: "%" }],
        },
      }),
    ).toBeUndefined();
    expect(
      chooseSceneMotion({ role: "chart", text: "No supplied values" }),
    ).toBeUndefined();
    expect(motionBarScaleMax(comparison.series[0])).toBe(100);
    expect(motionBarScaleMax({ label: "Sales", values: [32, 72] })).toBe(72);
    expect(motionSpotlightFraction(single.series[0])).toBe(0.72);
    expect(
      motionSpotlightFraction({ label: "Sales", values: [72] }),
    ).toBeUndefined();
    expect(
      chooseSceneMotion({
        role: "metric",
        text: "Tiny value",
        chart: {
          labels: ["Rate"],
          series: [{ label: "Sample", values: [0.000001] }],
        },
      }),
    ).toBeUndefined();
  });

  it("selects and preserves diagrams only with short supplied ideas", () => {
    const items = ["Idea", "Storyboard", "Animation", "Review"];
    expect(
      chooseSceneMotion({ role: "diagram", text: "Build the story", items }),
    ).toEqual(motionDirection("diagram-path"));
    expect(
      chooseSceneMotion({
        role: "diagram",
        text: "Build the story",
        items,
        previous: motionDirection("diagram-path"),
      }),
    ).toEqual(motionDirection("diagram-orbit"));
    expect(
      chooseSceneMotion({
        role: "diagram",
        text: "Build the story",
        items,
        current: motionDirection("diagram-orbit"),
      }),
    ).toEqual(motionDirection("diagram-orbit"));
    expect(
      resolveMotionDirection(
        motionDirection("diagram-orbit"),
        "Build the story",
        undefined,
        false,
        items,
      ),
    ).toEqual(motionDirection("diagram-orbit"));
    expect(
      chooseSceneMotion({
        role: "diagram",
        text: "Build",
        items: ["Only one"],
      }),
    ).toBeUndefined();
    expect(
      resolveMotionDirection(
        motionDirection("type-impact"),
        "Build",
        undefined,
        false,
        items,
      ),
    ).toBeUndefined();
    expect(
      resolveMotionDirection(
        motionDirection("diagram-path"),
        "Build",
        undefined,
        true,
        items,
      ),
    ).toBeUndefined();
  });

  it("uses supplied images for media treatments and keeps video on the legacy path", () => {
    const image = { type: "image" as const, url: "/media/shot.png" };
    expect(
      chooseSceneMotion({
        role: "screenshot-demo",
        text: "See the editor",
        background: image,
      }),
    ).toEqual(motionDirection("media-device"));
    expect(
      chooseSceneMotion({
        role: "hero",
        text: "A cinematic introduction",
        background: image,
      }),
    ).toEqual(motionDirection("media-cinematic"));
    expect(
      resolveMotionDirection(
        motionDirection("media-device"),
        "See the editor",
        undefined,
        false,
        undefined,
        image,
      ),
    ).toEqual(motionDirection("media-device"));
    expect(
      chooseSceneMotion({
        role: "screenshot-demo",
        text: "See the editor",
        background: { type: "video", url: "/media/shot.mp4" },
      }),
    ).toBeUndefined();
    expect(
      chooseSceneMotion({
        role: "hero",
        text: "A cinematic introduction",
        background: image,
        items: ["Do not hide me"],
      }),
    ).toBeUndefined();
  });
});
