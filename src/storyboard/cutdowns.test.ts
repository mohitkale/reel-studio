import { describe, expect, it } from "vitest";

import { cutdowns } from "./cutdowns";
import { lintStoryboard } from "./lint";
import type { VideoStoryboard } from "./schema";

const scene = (i: number, type: string, words = 24) => ({
  type,
  headline: `Scene ${i}`,
  narration: `${Array.from({ length: words }, (_, w) => `w${i}x${w}`).join(" ")}.`,
  ...(type === "stat" ? { stat: { value: "40%", label: "of people" } } : {}),
  ...(type === "quote"
    ? { quote: { text: "Plain words.", attribution: "A. Writer" } }
    : {}),
  ...(type === "list" ? { items: ["First point", "Second point"] } : {}),
});

function longVideo(withChapters: boolean): VideoStoryboard {
  const scenes = [
    scene(0, "hook"),
    ...Array.from({ length: 5 }, (_, i) => scene(i + 1, "statement")),
    {
      type: "statement",
      headline: "Part two",
      narration: "Chapter 2. Part two.",
    },
    scene(7, "stat"),
    ...Array.from({ length: 5 }, (_, i) => scene(i + 8, "statement")),
    {
      type: "statement",
      headline: "Part three",
      narration: "Chapter 3. Part three.",
    },
    scene(14, "quote"),
    ...Array.from({ length: 5 }, (_, i) => scene(i + 15, "list")),
    scene(20, "cta"),
  ];
  const result = lintStoryboard({
    version: 1,
    title: "A long talk",
    theme: "midnight-tech",
    format: "16:9",
    scenes,
    ...(withChapters
      ? {
          chapters: [
            { title: "Setting the scene", startScene: 0 },
            { title: "Part two", startScene: 6 },
            { title: "Part three", startScene: 13 },
          ],
        }
      : {}),
  });
  expect(result.errors).toEqual([]);
  return result.storyboard as VideoStoryboard;
}

describe("cutdowns", () => {
  it("makes vertical shorts from chapters, each valid, short and ending on a close", () => {
    const shorts = cutdowns(longVideo(true), { count: 3, maxSeconds: 45 });
    expect(shorts).toHaveLength(3);
    for (const short of shorts) {
      expect(short.storyboard.format).toBe("9:16");
      expect(short.storyboard.theme).toBe("midnight-tech");
      expect(short.seconds).toBeLessThanOrEqual(45);
      expect(short.storyboard.scenes.at(-1)!.type).toBe("cta");
      expect(lintStoryboard(short.storyboard).errors).toEqual([]);
      expect(
        (short.storyboard as { chapters?: unknown }).chapters,
      ).toBeUndefined();
    }
  });

  it("never reuses a scene across two shorts", () => {
    const shorts = cutdowns(longVideo(true), { count: 5 });
    const used = new Set<number>();
    for (const short of shorts)
      for (let i = short.from; i <= short.to; i++) {
        expect(used.has(i), `scene ${i}`).toBe(false);
        used.add(i);
      }
  });

  it("skips the card that only names a chapter, and adds a hook when the run has none", () => {
    const shorts = cutdowns(longVideo(true), { count: 3 });
    const second = shorts.find((s) => s.storyboard.title === "Part two");
    expect(second).toBeDefined();
    // Scene 6 is the title card; the run begins at scene 7, a stat.
    expect(second!.from).toBe(7);
    const plain = shorts.find(
      (s) => s.storyboard.title === "Setting the scene",
    )!;
    expect(plain.storyboard.scenes[0]!.type).toBe("hook");
  });

  it("splits a video without chapters at its hook-like scenes", () => {
    const shorts = cutdowns(longVideo(false), { count: 5 });
    expect(shorts.length).toBeGreaterThanOrEqual(3);
    expect(shorts.every((s) => s.to >= s.from + 1)).toBe(true);
  });

  it("is deterministic and respects the count and the length limit", () => {
    const board = longVideo(true);
    expect(cutdowns(board)).toEqual(cutdowns(board));
    expect(cutdowns(board, { count: 1 })).toHaveLength(1);
    expect(cutdowns(board, { count: 99 }).length).toBeLessThanOrEqual(5);
    for (const short of cutdowns(board, { maxSeconds: 20 }))
      expect(short.seconds).toBeLessThanOrEqual(20);
  });

  it("gives back nothing for a video too short to cut", () => {
    const tiny = lintStoryboard({
      version: 1,
      title: "Tiny",
      scenes: [scene(0, "hook", 6), scene(1, "cta", 6)],
    }).storyboard as VideoStoryboard;
    expect(cutdowns(tiny)).toEqual([]);
  });
});
