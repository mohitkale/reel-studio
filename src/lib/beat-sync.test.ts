import { describe, expect, it } from "vitest";

import {
  beatAlignedGaps,
  gridStepSeconds,
  offBeatSeconds,
  MAX_GAP_SECONDS,
  MIN_GAP_SECONDS,
} from "./beat-sync";

const grid = { bpm: 120, offsetSeconds: 0.1 }; // a beat every 0.5 s

function starts(durations: number[], gaps: number[]) {
  const out = [0];
  durations.slice(0, -1).forEach((d, i) => out.push(out[i]! + d + gaps[i]!));
  return out;
}

describe("beat aligned gaps", () => {
  const durations = [3.07, 4.41, 2.93, 5.2];

  it("puts every scene start on a beat when the beats are close enough together", () => {
    const gaps = beatAlignedGaps({ durations, grid });
    expect(gaps).toHaveLength(3);
    const off = offBeatSeconds(starts(durations, gaps).slice(1), grid);
    off.forEach((o) => expect(o).toBeLessThan(0.002));
  });

  it("keeps every gap inside the window, so speech and pacing barely move", () => {
    for (const bpm of [60, 75, 90, 120, 150]) {
      const gaps = beatAlignedGaps({
        durations,
        grid: { bpm, offsetSeconds: 0 },
      });
      gaps.forEach((g) => {
        expect(g).toBeGreaterThanOrEqual(MIN_GAP_SECONDS - 1e-6);
        expect(g).toBeLessThanOrEqual(MAX_GAP_SECONDS + 1e-6);
      });
    }
  });

  it("lands on the half beat (or finer) for slow music, so there is always a point in the window", () => {
    // 40 bpm: a beat every 1.5 s, wider than the 0.5 s window.
    const slow = { bpm: 40, offsetSeconds: 0 };
    expect(gridStepSeconds(slow)).toBeCloseTo(0.375);
    const slowDurations = [2.0, 2.31, 2.9, 3.17];
    const gaps = beatAlignedGaps({ durations: slowDurations, grid: slow });
    offBeatSeconds(starts(slowDurations, gaps).slice(1), slow).forEach((o) =>
      expect(o).toBeLessThan(0.002),
    );
  });

  it("counts the cover frame before the narration", () => {
    const gaps = beatAlignedGaps({ durations, grid, coverSeconds: 0.2 });
    const off = offBeatSeconds(starts(durations, gaps).slice(1), grid, 0.2);
    off.forEach((o) => expect(o).toBeLessThan(0.002));
  });

  it("is deterministic and handles one scene", () => {
    expect(beatAlignedGaps({ durations, grid })).toEqual(
      beatAlignedGaps({ durations, grid }),
    );
    expect(beatAlignedGaps({ durations: [4], grid })).toEqual([]);
  });
});
