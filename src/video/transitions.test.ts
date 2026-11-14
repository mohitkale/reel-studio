import { describe, expect, it } from "vitest";

import { pickTransitions, SHOWY_TRANSITIONS } from "./transitions";

const PERSONALITIES = [
  "snappy",
  "smooth",
  "punchy",
  "calm",
  "bouncy",
  "hard",
  "slow",
] as const;

describe("pickTransitions", () => {
  it.each(PERSONALITIES)("%s: deterministic, never two showy in a row", (p) => {
    const a = pickTransitions(14, p);
    expect(a).toEqual(pickTransitions(14, p));
    expect(a).toHaveLength(14);
    expect(a[0]).toBe("cut");
    for (let i = 1; i < a.length; i++) {
      expect(
        SHOWY_TRANSITIONS.includes(a[i]!) &&
          SHOWY_TRANSITIONS.includes(a[i - 1]!),
      ).toBe(false);
    }
  });

  it("uses more than one kind of transition on a long video", () => {
    expect(new Set(pickTransitions(12, "snappy")).size).toBeGreaterThan(1);
  });
});
