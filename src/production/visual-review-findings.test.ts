import { expect, it } from "vitest";
import type { ReelScene } from "@/compositions/types";
import { motionDirection } from "./motion";
import { reviewVisualInputs } from "./visual-review-findings";

const scene = (id: string, text = "A clear idea"): ReelScene => ({
  id,
  text,
  templateId: "hook",
  emphasis: [],
  motion: motionDirection("type-impact"),
});

it("uses visible copy, Unicode characters, actual holds and cover timestamps without modifying content", () => {
  const scenes = [scene("first", "界".repeat(80)), scene("last", "Short")];
  const before = structuredClone(scenes);
  const timeline = [
    { sceneId: "first", startFrame: 0, durationFrames: 30 },
    { sceneId: "last", startFrame: 60, durationFrames: 90 },
  ];
  const findings = reviewVisualInputs(
    scenes,
    timeline,
    ["first", "last"],
    30,
    45,
  );
  expect(findings).toEqual([
    expect.objectContaining({
      sceneId: "first",
      sceneNumber: 1,
      frame: 45,
      kind: "reading-time",
      message: expect.stringContaining("5.0s"),
    }),
  ]);
  expect(findings[0].message).toContain("2.0s");
  expect(reviewVisualInputs(scenes, timeline, ["last"], 30)).toEqual([]);
  expect(
    reviewVisualInputs(
      [{ ...scenes[0], hideText: true }, scenes[1]],
      timeline,
      ["first"],
      30,
    ),
  ).toEqual([]);
  expect(scenes).toEqual(before);
});

it("reports repeated treatments on later sheets and respects hidden/fallback breaks", () => {
  const scenes = Array.from({ length: 12 }, (_, index) => scene(String(index)));
  const timeline = scenes.map((item, index) => ({
    sceneId: item.id,
    startFrame: index * 90,
    durationFrames: 90,
  }));
  expect(reviewVisualInputs(scenes, timeline, ["8", "9"], 30, 30)).toEqual([
    expect.objectContaining({
      kind: "repetition",
      sceneId: "8",
      sceneNumber: 9,
      frame: 750,
      message: expect.stringContaining("Scenes 1–12"),
    }),
  ]);
  scenes[8].hideText = true;
  scenes[9].motion = motionDirection("data-bars");
  const findings = reviewVisualInputs(scenes, timeline, ["8", "9"], 30);
  expect(findings).toHaveLength(1);
  expect(findings[0]).toMatchObject({
    kind: "fallback",
    sceneId: "9",
    frame: 810,
  });
  expect(findings[0].message).toContain("supplied chart values");
});

it("ignores narration length and tolerates empty, hidden and missing timed copy", () => {
  const scenes = [
    scene("empty", "  "),
    { ...scene("hidden", "a".repeat(200)), hideText: true },
    scene("untimed"),
  ];
  const timeline = [
    { sceneId: "empty", startFrame: 0, durationFrames: 1 },
    { sceneId: "hidden", startFrame: 1, durationFrames: 1 },
  ];
  expect(
    reviewVisualInputs(
      scenes,
      timeline,
      scenes.map((item) => item.id),
      60,
    ),
  ).toEqual([]);
  expect(reviewVisualInputs(scenes, timeline, ["empty"], 0)).toEqual([]);
});
