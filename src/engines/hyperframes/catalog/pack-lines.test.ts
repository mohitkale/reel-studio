import { describe, expect, it } from "vitest";

import { packLines } from "./native-visuals";

const lastWords = (lines: string[]) => lines.at(-1)!.split(" ").length;

describe("packLines", () => {
  it("keeps short copy on one line", () => {
    expect(packLines("Sleep is a skill", 24)).toEqual(["Sleep is a skill"]);
  });

  it("never leaves a lone last word in copy of four words or more", () => {
    const copies = [
      "Because the effect builds quietly over weeks and months until the change feels obvious",
      "Start smaller than feels useful and let the routine earn its place",
      "A strong explainer begins with one clear idea and a promise to the viewer",
      "The first three seconds decide whether anyone stays to watch",
    ];
    for (const text of copies) {
      for (const [chars, words] of [
        [18, 99],
        [24, 3],
        [12, 2],
      ] as const) {
        const lines = packLines(text, chars, words);
        expect(lines.join(" "), `${text} @${chars}/${words}`).toBe(text);
        expect(lastWords(lines), `${lines.join(" | ")}`).toBeGreaterThanOrEqual(
          2,
        );
      }
    }
  });

  it("evens out the lines instead of filling greedily", () => {
    const lines = packLines(
      "Because the effect builds quietly over weeks and months",
      18,
    );
    const lengths = lines.map((l) => l.length);
    expect(Math.max(...lengths) - Math.min(...lengths)).toBeLessThanOrEqual(6);
  });

  it("keeps a number with its unit on one line", () => {
    for (const [chars, words] of [
      [12, 2],
      [18, 99],
      [24, 3],
    ] as const) {
      const lines = packLines(
        "Save two hundred dollars by changing one 10 minute habit every day",
        chars,
        words,
      );
      expect(lines.some((l) => l.includes("10 minute"))).toBe(true);
    }
    expect(
      packLines(
        "Over 73% of adults sleep under 7 hours every night",
        12,
        2,
      ).some((l) => l.includes("7 hours")),
    ).toBe(true);
  });

  it("keeps a short emphasized phrase together", () => {
    for (const [chars, words] of [
      [12, 2],
      [18, 99],
    ] as const) {
      const lines = packLines(
        "Make the first three seconds count for everything today",
        chars,
        words,
        ["first three seconds"],
      );
      expect(lines.some((l) => l.includes("first three seconds"))).toBe(true);
    }
  });

  it("handles a single very long word", () => {
    expect(packLines("Supercalifragilisticexpialidocious", 12)).toEqual([
      "Supercalifragilisticexpialidocious",
    ]);
  });
});
