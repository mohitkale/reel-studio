import { describe, expect, it } from "vitest";

import { lipSyncReport, opennessAt, pearson } from "./lip-sync-check";
import type { MouthKey } from "./visemes";

/** A voice that is loud in the first half of each second and quiet in the second half. */
const pulse = (t: number) => (t % 1 < 0.5 ? 1 : 0.05);
const inStep: MouthKey[] = Array.from({ length: 6 }, (_, i) => [
  { viseme: "ah" as const, start: i, end: i + 0.5 },
  { viseme: "rest" as const, start: i + 0.5, end: i + 1 },
]).flat();

describe("lip sync check", () => {
  it("scores a mouth that follows the voice highly, with no lag", () => {
    const r = lipSyncReport(inStep, pulse, 6);
    expect(r.agreement).toBeGreaterThan(0.95);
    expect(r.activeWhenSpeaking).toBeGreaterThan(0.95);
    expect(r.restWhenSilent).toBeGreaterThan(0.95);
    expect(Math.abs(r.bestLagSeconds)).toBeLessThan(0.05);
  });

  it("finds a mouth that is late", () => {
    const late = inStep.map((k) => ({
      ...k,
      start: k.start + 0.16,
      end: k.end + 0.16,
    }));
    const r = lipSyncReport(late, pulse, 6);
    expect(r.agreement).toBeLessThan(0.85);
    expect(Math.abs(r.bestLagSeconds)).toBeGreaterThanOrEqual(0.12);
  });

  it("catches a mouth stuck open", () => {
    const stuck: MouthKey[] = [{ viseme: "ah", start: 0, end: 6 }];
    const r = lipSyncReport(stuck, pulse, 6);
    expect(r.restWhenSilent).toBe(0);
    expect(r.agreement).toBeLessThan(0.6);
  });

  it("measures openness and correlation sanely", () => {
    expect(opennessAt(inStep, 0.2)).toBe(1);
    expect(opennessAt(inStep, 0.7)).toBe(0);
    expect(pearson([1, 2, 3], [2, 4, 6])).toBeCloseTo(1);
    expect(pearson([1, 2, 3], [3, 2, 1])).toBeCloseTo(-1);
  });
});
