import { describe, expect, it } from "vitest";

import { shareBackdrops } from "./backdrops";

const photo = (url: string, stock = false) => ({
  type: "image" as const,
  url,
  stock,
  effect: "ken-burns" as const,
});

describe("shareBackdrops", () => {
  it("gives text scenes the nearest supplied picture, with a different move each", () => {
    const ids = ["hf-opener", "hf-broll", "hf-stat", "hf-quote", "hf-broll"];
    const out = shareBackdrops(ids, [
      undefined,
      photo("/a.jpg"),
      undefined,
      undefined,
      photo("/b.jpg"),
    ]);
    expect(out[0]?.url).toBe("/a.jpg");
    expect(out[2]?.url).toBe("/a.jpg");
    expect(out[3]?.url).toBe("/b.jpg");
    expect(new Set([out[0]?.effect, out[2]?.effect, out[3]?.effect]).size).toBe(
      3,
    );
    expect(out[1]).toEqual(photo("/a.jpg"));
  });

  it("never borrows a stock photo and leaves data scenes alone", () => {
    const ids = ["hf-opener", "hf-broll", "hf-timeline"];
    const out = shareBackdrops(ids, [
      undefined,
      photo("/stock.jpg", true),
      undefined,
    ]);
    expect(out[0]).toBeUndefined();
    expect(out[2]).toBeUndefined();
  });

  it("does not reach past three scenes and changes nothing without pictures", () => {
    const far = shareBackdrops(
      [
        "hf-broll",
        "hf-statement",
        "hf-statement",
        "hf-statement",
        "hf-statement",
      ],
      [photo("/a.jpg"), undefined, undefined, undefined, undefined],
    );
    expect(far[3]?.url).toBe("/a.jpg");
    expect(far[4]).toBeUndefined();
    expect(shareBackdrops(["hf-opener"], [undefined])).toEqual([undefined]);
  });
});
