import { describe, it, expect } from "vitest";

import { makeSilentWav, parseWav } from "./wav";
import {
  estimateSpeechSeconds,
  framesFromSeconds,
  stitchBeats,
} from "./audio-timing";

describe("framesFromSeconds", () => {
  it("rounds seconds to whole frames", () => {
    expect(framesFromSeconds(1, 30)).toBe(30);
    expect(framesFromSeconds(1.3, 30)).toBe(39);
  });
});

describe("estimateSpeechSeconds", () => {
  it("scales with word count and enforces a floor", () => {
    expect(estimateSpeechSeconds("")).toBeCloseTo(2.0, 5);
    expect(estimateSpeechSeconds(Array(150).fill("word").join(" "))).toBeCloseTo(
      60,
      5,
    );
  });
});

describe("stitchBeats", () => {
  it("computes start/duration frames with gaps and a single output WAV", () => {
    const beats = [
      { sceneId: "a", text: "one", wav: makeSilentWav(1) },
      { sceneId: "b", text: "two", wav: makeSilentWav(2) },
    ];
    const result = stitchBeats(beats, 30, 0.3);

    expect(result.timeline).toEqual([
      { sceneId: "a", startFrame: 0, durationFrames: 30, text: "one" },
      { sceneId: "b", startFrame: 39, durationFrames: 60, text: "two" },
    ]);
    // 1s + 0.3s gap + 2s = 3.3s -> 99 frames at 30fps.
    expect(result.totalFrames).toBe(99);

    // The stitched WAV is real and as long as the sum of beats + gap.
    const info = parseWav(result.wav);
    expect(info.durationSeconds).toBeCloseTo(3.3, 2);
  });

  it("supports per-transition gap arrays", () => {
    const beats = [
      { sceneId: "a", text: "one", wav: makeSilentWav(1) },
      { sceneId: "b", text: "two", wav: makeSilentWav(1) },
      { sceneId: "c", text: "three", wav: makeSilentWav(1) },
    ];
    const result = stitchBeats(beats, 30, [0.5, 1.0]);
    expect(result.timeline[0].startFrame).toBe(0);
    expect(result.timeline[1].startFrame).toBe(45); // 1s + 0.5s
    expect(result.timeline[2].startFrame).toBe(105); // +1s + 1.0s
    expect(result.totalFrames).toBe(135); // 3s + 1.5s gaps
  });

  it("handles an empty beat list", () => {
    const result = stitchBeats([], 30);
    expect(result.totalFrames).toBe(0);
    expect(result.timeline).toEqual([]);
  });
});
