import { describe, it, expect } from "vitest";
import {
  cutAudioRange,
  rebaseAudioSegments,
  encodeAudioWav,
  audioEditPlanSchema,
  type AudioEditPlan,
} from "./audio-edit-plan";
const original: AudioEditPlan = {
  version: 1,
  ranges: [{ start: 0, end: 10 }],
  gains: {},
  cleanup: false,
};
describe("non-destructive audio edits", () => {
  it("splits around a removed interval without changing the original", () => {
    expect(cutAudioRange(original, 3, 6).ranges).toEqual([
      { start: 0, end: 3 },
      { start: 6, end: 10 },
    ]);
    expect(original.ranges).toEqual([{ start: 0, end: 10 }]);
  });
  it("rejects removing all audio and overlapping imported ranges", () => {
    expect(() => cutAudioRange(original, 0, 10)).toThrow();
    expect(
      audioEditPlanSchema.safeParse({
        ...original,
        ranges: [
          { start: 0, end: 5 },
          { start: 3, end: 8 },
        ],
      }).success,
    ).toBe(false);
  });
  it("rebases transcript timestamps through removed gaps", () => {
    expect(
      rebaseAudioSegments(
        [
          { id: "a", text: "Before", start: 1, end: 2, speaker: "A" },
          { id: "b", text: "After", start: 7, end: 9, speaker: "B" },
        ],
        [
          { start: 0, end: 3 },
          { start: 6, end: 10 },
        ],
      ).map((s) => [s.start, s.end]),
    ).toEqual([
      [1, 2],
      [4, 6],
    ]);
  });
  it("marks partially cut text for review instead of claiming exact captions", () => {
    const segment = {
      id: "a",
      text: "A whole sentence",
      start: 0,
      end: 5,
      speaker: "A",
    };
    expect(
      rebaseAudioSegments([segment], [{ start: 1, end: 4 }])[0],
    ).toMatchObject({ textNeedsReview: true, start: 0, end: 3 });
    expect(
      rebaseAudioSegments([segment], [{ start: 0, end: 5 }])[0].textNeedsReview,
    ).toBeUndefined();
  });
  it("exports interleaved stereo PCM with saturation and correct header", () => {
    const wav = new DataView(
      encodeAudioWav(
        [new Float32Array([-2, 0.5]), new Float32Array([2, -0.5])],
        44100,
      ),
    );
    expect(wav.getUint16(22, true)).toBe(2);
    expect(wav.getUint32(40, true)).toBe(8);
    expect(wav.getInt16(44, true)).toBe(-32768);
    expect(wav.getInt16(46, true)).toBe(32767);
  });
});
