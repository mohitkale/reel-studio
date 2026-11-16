import { describe, expect, it } from "vitest";

import {
  clipSpans,
  speechSpansFromPcm,
  timeAtVoicedFraction,
} from "./speech-spans";

const RATE = 16000;

/** Tone bursts at the given [start, end] seconds, silence elsewhere. */
function signal(seconds: number, bursts: Array<[number, number]>): Int16Array {
  const out = new Int16Array(Math.round(seconds * RATE));
  for (const [a, b] of bursts)
    for (let i = Math.round(a * RATE); i < Math.round(b * RATE); i++)
      out[i] = Math.round(Math.sin((i / RATE) * 2 * Math.PI * 220) * 12000);
  return out;
}

describe("speechSpansFromPcm", () => {
  it("finds the bursts and the pause between them", () => {
    const spans = speechSpansFromPcm(
      signal(3, [
        [0.3, 1.0],
        [1.5, 2.2],
      ]),
      RATE,
    );
    expect(spans).toHaveLength(2);
    expect(spans[0]![0]).toBeCloseTo(0.3, 1);
    expect(spans[0]![1]).toBeCloseTo(1.0, 1);
    expect(spans[1]![0]).toBeCloseTo(1.5, 1);
  });

  it("bridges a breath-length gap but not a pause", () => {
    const spans = speechSpansFromPcm(
      signal(2, [
        [0.2, 0.7],
        [0.77, 1.2],
        [1.5, 1.9],
      ]),
      RATE,
    );
    expect(spans).toHaveLength(2);
    expect(spans[0]![1]).toBeCloseTo(1.2, 1);
  });

  it("returns nothing for silence", () => {
    expect(speechSpansFromPcm(new Int16Array(RATE), RATE)).toEqual([]);
  });
});

describe("span helpers", () => {
  it("clips to a window", () => {
    expect(
      clipSpans(
        [
          [0, 1],
          [2, 3],
        ],
        0.5,
        2.5,
      ),
    ).toEqual([
      [0.5, 1],
      [2, 2.5],
    ]);
  });

  it("walks a fraction of the voiced time, skipping the gap", () => {
    const spans: Array<[number, number]> = [
      [0, 1],
      [3, 4],
    ];
    expect(timeAtVoicedFraction(spans, 0.25)).toBeCloseTo(0.5);
    expect(timeAtVoicedFraction(spans, 0.75)).toBeCloseTo(3.5);
    expect(timeAtVoicedFraction(spans, 1)).toBeCloseTo(4);
  });
});
