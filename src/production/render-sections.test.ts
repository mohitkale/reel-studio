import { expect, it } from "vitest";
import { planRenderSections } from "./render-sections";
it("partitions global frame ranges exactly once, including chapter starts and partial tails", () => {
  const sections = planRenderSections(6001, 30, [750, 3500, 750, -1, 6001]);
  const frames = sections.flatMap((section) =>
    Array.from(
      { length: section.endFrame - section.startFrame + 1 },
      (_, index) => section.startFrame + index,
    ),
  );
  expect(frames).toEqual(Array.from({ length: 6001 }, (_, index) => index));
  expect(sections.some((section) => section.startFrame === 750)).toBe(true);
  expect(sections.some((section) => section.startFrame === 3500)).toBe(true);
  expect(
    sections.every((section) => section.endFrame - section.startFrame < 900),
  ).toBe(true);
  expect(planRenderSections(1, 30)).toEqual([
    { index: 0, startFrame: 0, endFrame: 0 },
  ]);
  for (const [frames, fps] of [
    [0, 30],
    [1, 0],
    [1, 61],
    [18001, 30],
    [1.5, 30],
  ])
    expect(() => planRenderSections(frames, fps)).toThrow();
});
