import { describe, expect, it } from "vitest";

import { planArrangements, planLook, type LookSceneInput } from "./variety";

const TEMPLATES = [
  "hf-opener",
  "hf-statement",
  "hf-list",
  "hf-stat",
  "hf-quote",
  "hf-steps",
  "hf-data-chart",
  "hf-statement",
  "hf-statement",
  "hf-quote",
  "hf-cta",
];
const scenes: LookSceneInput[] = TEMPLATES.map((templateId) => ({
  templateId,
  seconds: 5,
}));
const base = {
  scenes,
  personality: "snappy",
  themeBackground: "grid",
} as const;

describe("planLook", () => {
  it("is byte-stable for the same seed", () => {
    const a = planLook({ ...base, seed: "alpha" });
    expect(JSON.stringify(a)).toBe(
      JSON.stringify(planLook({ ...base, seed: "alpha" })),
    );
  });

  it("gives different looks for different seeds", () => {
    const looks = new Set(
      ["a", "b", "c", "d", "e"].map((seed) =>
        JSON.stringify(
          planLook({ ...base, seed, variety: "high" }).scenes.map((s) => [
            s.layout,
            s.motion,
            s.camera,
          ]),
        ),
      ),
    );
    expect(looks.size).toBe(5);
  });

  it.each(["low", "medium", "high"] as const)(
    "%s: never repeats a layout back to back",
    (variety) => {
      for (const seed of ["1", "2", "3", "4", "5", "6"]) {
        const { scenes: out } = planLook({ ...base, seed, variety });
        for (let i = 1; i < out.length; i++)
          expect(out[i]!.layout).not.toBe(out[i - 1]!.layout);
      }
    },
  );

  it("never repeats an entrance back to back", () => {
    for (const seed of ["1", "2", "3", "4"]) {
      const { scenes: out } = planLook({ ...base, seed, variety: "high" });
      for (let i = 1; i < out.length; i++)
        expect(out[i]!.motion).not.toBe(out[i - 1]!.motion);
    }
  });

  it("opens with a visual peak and keeps one about every fifteen seconds", () => {
    const { scenes: out } = planLook({ ...base, seed: "x", variety: "medium" });
    expect(out[0]!.peak).toBe(true);
    const peaks = out.flatMap((s, i) => (s.peak ? [i] : []));
    for (let i = 1; i < peaks.length; i++)
      expect((peaks[i]! - peaks[i - 1]!) * 5).toBeLessThanOrEqual(20);
  });

  it("never puts a camera move on two scenes in a row, and none with reduceMotion", () => {
    for (const seed of ["p", "q", "r"]) {
      const { scenes: out } = planLook({ ...base, seed, variety: "high" });
      for (let i = 1; i < out.length; i++)
        expect(out[i]!.camera !== "none" && out[i - 1]!.camera !== "none").toBe(
          false,
        );
    }
    const calm = planLook({
      ...base,
      seed: "p",
      variety: "high",
      reduceMotion: true,
    });
    expect(
      calm.scenes.every((s) => s.camera === "none" && s.motion === "rise"),
    ).toBe(true);
  });

  it("low variety keeps the theme's own background", () => {
    expect(planLook({ ...base, seed: "z", variety: "low" }).background).toBe(
      "grid",
    );
  });
});

describe("arrangements", () => {
  const sameType = Array.from({ length: 8 }, () => "hf-steps");

  it("never repeats an arrangement for the same scene type back to back (medium, high)", () => {
    for (const seed of ["a", "b", "c", "d", "e", "f"]) {
      for (const variety of ["medium", "high"] as const) {
        const out = planArrangements({
          templateIds: sameType,
          seed,
          variety,
        });
        for (let i = 1; i < out.length; i++)
          expect(out[i]).not.toBe(out[i - 1]);
      }
    }
  });

  it("uses all three arrangements across a high-variety video", () => {
    const used = new Set(
      ["a", "b", "c", "d", "e", "f"].flatMap((seed) =>
        planArrangements({
          templateIds: TEMPLATES,
          seed,
          variety: "high",
        }),
      ),
    );
    expect([...used].sort()).toEqual([1, 2, 3]);
  });

  it("keeps the classic arrangement most of the time at low variety", () => {
    const out = planArrangements({
      templateIds: TEMPLATES.concat(TEMPLATES, TEMPLATES),
      seed: "calm",
      variety: "low",
    });
    expect(out.filter((a) => a === 1).length).toBeGreaterThan(out.length / 2);
  });

  it("is reproducible and can be forced", () => {
    const input = {
      templateIds: TEMPLATES,
      seed: "x",
      variety: "medium",
    } as const;
    expect(planArrangements(input)).toEqual(planArrangements(input));
    expect(planArrangements({ ...input, force: 3 })).toEqual(
      TEMPLATES.map(() => 3),
    );
  });

  it("does not move the layout, motion or camera a seed already produced", () => {
    const plain = planLook({ ...base, seed: "keep", variety: "high" });
    const forced = planLook({
      ...base,
      seed: "keep",
      variety: "high",
      forceArrange: 2,
    });
    expect(
      forced.scenes.map(({ layout, motion, camera }) => [
        layout,
        motion,
        camera,
      ]),
    ).toEqual(
      plain.scenes.map(({ layout, motion, camera }) => [
        layout,
        motion,
        camera,
      ]),
    );
    expect(plain.scenes.every((s) => [1, 2, 3].includes(s.arrange))).toBe(true);
  });
});
