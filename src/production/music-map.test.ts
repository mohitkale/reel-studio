import { describe, expect, it } from "vitest";
import {
  musicBeatAnchors,
  musicMapSchema,
  proposeMusicRhythm,
} from "./music-map";
const map = musicMapSchema.parse({
  version: 1,
  sourceUrl: "/music/test.wav",
  sourceHash: "a".repeat(64),
  durationSeconds: 1.4,
  bpm: 120,
  offsetSeconds: 0.1,
  confidence: 0.8,
  method: "energy-onsets",
  disabledBeats: [1],
  dropSeconds: null,
});

describe("music timing review", () => {
  it("restarts the grid at actual loop boundaries and retains disabled beat choices", () => {
    expect(musicBeatAnchors(map, 3).map((beat) => beat.seconds)).toEqual([
      0.1, 0.6, 1.1, 1.5, 2, 2.5, 2.9,
    ]);
    expect(
      musicBeatAnchors(map, 3)
        .filter((beat) => beat.disabled)
        .map((beat) => beat.seconds),
    ).toEqual([0.6, 2]);
  });
  it("proposes an accurate periodic pulse grid without fabricating a grid for silence or pads", () => {
    const rate = 8000;
    const samples = new Float32Array(rate * 8);
    for (let time = 0.12; time < 8; time += 0.5)
      for (
        let index = Math.round(time * rate);
        index < Math.round(time * rate) + 80;
        index++
      )
        samples[index] = 0.8;
    const proposal = proposeMusicRhythm(samples, rate);
    expect(proposal?.bpm).toBeCloseTo(120, 0);
    expect(proposal?.offsetSeconds).toBeCloseTo(0.12, 2);
    expect(proposal?.confidence).toBeGreaterThan(0.8);
    expect(
      proposeMusicRhythm(new Float32Array(rate * 8), rate),
    ).toBeUndefined();
    expect(
      proposeMusicRhythm(new Float32Array(rate * 8).fill(0.2), rate),
    ).toBeUndefined();
    expect(proposeMusicRhythm(samples, 0)).toBeUndefined();
  });
  it("rejects offsets outside a beat, invalid drop positions and unsupported versions", () => {
    for (const changes of [
      { offsetSeconds: 0.5 },
      { dropSeconds: 1.4 },
      { bpm: Infinity },
      { bpm: 0 },
      { version: 2 },
      { disabledBeats: [720] },
    ])
      expect(musicMapSchema.safeParse({ ...map, ...changes }).success).toBe(
        false,
      );
  });
});
