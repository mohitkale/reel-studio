import { describe, expect, it } from "vitest";
import { motionDirection } from "@/production/motion";
import { reviewMotionTreatments } from "@/production/motion-review";

describe("motion treatment review", () => {
  it("reports real scene positions and the required repair in playback order", () => {
    expect(
      reviewMotionTreatments([
        { id: "preset", text: "An original preset" },
        { id: "data", text: "Sales", motion: motionDirection("data-bars") },
        {
          id: "valid",
          text: "A bold idea",
          motion: motionDirection("type-impact"),
        },
        {
          id: "media",
          text: "Product",
          motion: motionDirection("media-device"),
        },
      ]),
    ).toEqual([
      {
        sceneId: "data",
        sceneNumber: 2,
        reason: "Add one series of supplied chart values for this treatment.",
      },
      {
        sceneId: "media",
        sceneNumber: 4,
        reason: "Add a supplied image or video for this media treatment.",
      },
    ]);
  });

  it("skips intentionally hidden treatments but checks an explicit visible override", () => {
    expect(
      reviewMotionTreatments([
        {
          id: "hidden",
          text: "Sales",
          motion: motionDirection("data-bars"),
          hideText: true,
        },
        {
          id: "visible",
          text: "Sales",
          motion: motionDirection("data-bars"),
          hideText: false,
        },
      ]).map((issue) => issue.sceneId),
    ).toEqual(["visible"]);
  });

  it("accepts supplied charts, diagrams and footage without changing their inputs", () => {
    const scenes = [
      {
        id: "chart",
        text: "Growth",
        motion: motionDirection("data-bars"),
        chart: {
          labels: ["Before", "After"],
          series: [{ label: "Sales", values: [5, 10] }],
        },
      },
      {
        id: "diagram",
        text: "Process",
        motion: motionDirection("diagram-path"),
        items: ["Plan", "Build"],
      },
      {
        id: "footage",
        text: "Product",
        motion: motionDirection("media-device"),
        background: { type: "video" as const, url: "/media/demo.mp4" },
      },
    ];
    const before = structuredClone(scenes);
    expect(reviewMotionTreatments(scenes)).toEqual([]);
    expect(scenes).toEqual(before);
  });

  it("detects copy overflow and conflicting visuals, then clears repaired scenes", () => {
    const scene = {
      id: "title",
      text: "a".repeat(121),
      motion: motionDirection("type-impact"),
    };
    expect(reviewMotionTreatments([scene])[0]?.reason).toContain(
      "120 characters",
    );
    expect(
      reviewMotionTreatments([
        { ...scene, text: "Short", hasVisualContent: true },
      ])[0]?.reason,
    ).toContain("would hide");
    expect(reviewMotionTreatments([{ ...scene, text: "Short" }])).toEqual([]);
  });
});
