import { describe, expect, it } from "vitest";

import {
  ILLUSTRATION_MOTIFS,
  ILLUSTRATION_NAMES,
  ILLUSTRATION_STYLES,
  illustrationSvg,
  resolveIllustration,
} from "./illustrations";

describe("illustrations", () => {
  it("offers sixty named illustrations, five per motif", () => {
    expect(ILLUSTRATION_NAMES).toHaveLength(60);
    expect(new Set(ILLUSTRATION_NAMES).size).toBe(60);
    expect(ILLUSTRATION_MOTIFS).toHaveLength(12);
  });

  it("draws each one as a looping svg, different from every other", () => {
    const drawn = ILLUSTRATION_NAMES.map((name) => illustrationSvg(name)!);
    for (const [i, svg] of drawn.entries()) {
      expect(svg, ILLUSTRATION_NAMES[i]).toMatch(/^<svg class="il" /);
      expect(svg.endsWith("</svg>")).toBe(true);
      expect(svg).toMatch(
        /il-(spin|spin-r|sway|float|rise|pulse|grow|blink|twinkle|dash)/,
      );
      expect(svg).not.toMatch(/NaN|undefined|Infinity/);
    }
    expect(new Set(drawn).size).toBe(60);
  });

  it("is deterministic", () => {
    expect(illustrationSvg("stars-2")).toBe(illustrationSvg("stars-2"));
  });

  it("every animation class used has a keyframes rule", () => {
    const used = new Set(
      ILLUSTRATION_NAMES.flatMap(
        (n) =>
          illustrationSvg(n)!.match(
            /il-(?:spin-r|spin|sway|float|rise|pulse|grow|blink|twinkle|dash)\b/g,
          ) ?? [],
      ),
    );
    for (const cls of used)
      expect(ILLUSTRATION_STYLES).toContain(`.${cls} { animation-name:`);
  });

  it("resolves a name, a motif or a related word, and nothing else", () => {
    expect(resolveIllustration("bars-3")).toBe("bars-3");
    expect(resolveIllustration("Stars")).toBe("stars-1");
    expect(resolveIllustration("space")).toBe("stars-1");
    expect(resolveIllustration("growth")).toBe("bars-1");
    expect(resolveIllustration("unicorn")).toBeNull();
    expect(resolveIllustration(undefined)).toBeNull();
    expect(illustrationSvg("nope-9")).toBeNull();
  });
});
