import { describe, it, expect } from "vitest";

import { resolveReelTimeline } from "./reel-timeline";

const beat = (sceneId: string, startFrame: number, durationFrames: number, text: string) => ({
  sceneId,
  startFrame,
  durationFrames,
  text,
});

// A take for two scenes "Hello" / "World".
const take = {
  timeline: [beat("s1", 0, 30, "Hello"), beat("s2", 30, 30, "World")],
  totalFrames: 60,
};

describe("resolveReelTimeline", () => {
  it("falls back to estimated, unusable timing when there is no take", () => {
    const r = resolveReelTimeline([{ id: "s1", text: "Hello" }], null, 30);
    expect(r.takeUsable).toBe(false);
    expect(r.timeline).toHaveLength(1);
  });

  it("keeps the take when only non-text data changed (same text, same ids)", () => {
    const scenes = [
      { id: "s1", text: "Hello" },
      { id: "s2", text: "World" },
    ];
    const r = resolveReelTimeline(scenes, take, 30);
    expect(r.takeUsable).toBe(true);
    expect(r.totalFrames).toBe(60);
    expect(r.timeline.map((b) => b.sceneId)).toEqual(["s1", "s2"]);
  });

  it("remaps the take onto new scene ids when the text is unchanged (rewrite)", () => {
    // Same spoken text, brand-new ids (as an AI rewrite produces).
    const scenes = [
      { id: "new1", text: "Hello" },
      { id: "new2", text: "World" },
    ];
    const r = resolveReelTimeline(scenes, take, 30);
    expect(r.takeUsable).toBe(true);
    expect(r.timeline.map((b) => b.sceneId)).toEqual(["new1", "new2"]);
    // Recorded durations are preserved (audio stays synced).
    expect(r.timeline[1].startFrame).toBe(30);
  });

  it("ignores whitespace/case differences in the text", () => {
    const scenes = [
      { id: "s1", text: "  hello " },
      { id: "s2", text: "WORLD" },
    ];
    expect(resolveReelTimeline(scenes, take, 30).takeUsable).toBe(true);
  });

  it("becomes unusable when a scene's spoken text actually changes", () => {
    const scenes = [
      { id: "s1", text: "Hello" },
      { id: "s2", text: "Goodbye" },
    ];
    const r = resolveReelTimeline(scenes, take, 30);
    expect(r.takeUsable).toBe(false);
  });

  it("blends estimated timing for scenes appended after the take", () => {
    const scenes = [
      { id: "s1", text: "Hello" },
      { id: "s2", text: "World" },
      { id: "s3", text: "A brand new appended scene" },
    ];
    const r = resolveReelTimeline(scenes, take, 30);
    expect(r.takeUsable).toBe(true);
    expect(r.timeline).toHaveLength(3);
    // The appended scene starts after the recorded audio.
    expect(r.timeline[2].startFrame).toBeGreaterThanOrEqual(60);
    expect(r.totalFrames).toBeGreaterThan(60);
  });

  it("is unusable when scenes are reordered (text sequence differs)", () => {
    const scenes = [
      { id: "s2", text: "World" },
      { id: "s1", text: "Hello" },
    ];
    expect(resolveReelTimeline(scenes, take, 30).takeUsable).toBe(false);
  });
});
