import { describe, expect, it } from "vitest";

import {
  ILLUSTRATION_MOTIFS,
  ILLUSTRATION_NAMES,
  ILLUSTRATION_STYLES,
  illustrationSvg,
  resolveIllustration,
} from "./illustrations";

describe("illustrations", () => {
  it("offers 65 named illustrations, five per motif", () => {
    expect(ILLUSTRATION_NAMES).toHaveLength(65);
    expect(new Set(ILLUSTRATION_NAMES).size).toBe(65);
    expect(ILLUSTRATION_MOTIFS).toHaveLength(13);
  });

  it("draws each one as a looping svg, different from every other", () => {
    const drawn = ILLUSTRATION_NAMES.map((name) => illustrationSvg(name)!);
    for (const [i, svg] of drawn.entries()) {
      expect(svg, ILLUSTRATION_NAMES[i]).toMatch(/^<svg class="il" /);
      expect(svg.endsWith("</svg>")).toBe(true);
      expect(svg).toMatch(
        /il-(spin|spin-r|sway|float|rise|pulse|grow|blink|twinkle|dash|cloud-drift)/,
      );
      expect(svg).not.toMatch(/NaN|undefined|Infinity/);
    }
    expect(new Set(drawn).size).toBe(65);
  });

  it("draws five distinct cloud layouts", () => {
    const layouts = ILLUSTRATION_NAMES.filter((name) =>
      name.startsWith("clouds-"),
    ).map((name) =>
      illustrationSvg(name)!.replace(/ data-illustration="[^"]+"/, ""),
    );
    expect(new Set(layouts).size).toBe(5);
  });

  it("is deterministic", () => {
    expect(illustrationSvg("stars-2")).toBe(illustrationSvg("stars-2"));
  });

  it("every animation class used has a keyframes rule", () => {
    const used = new Set(
      ILLUSTRATION_NAMES.flatMap(
        (n) =>
          illustrationSvg(n)!.match(
            /il-(?:spin-r|spin|sway|float|rise|pulse|grow|blink|twinkle|dash|cloud-drift)\b/g,
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
    expect(resolveIllustration("cloud")).toBe("network-1");
    expect(resolveIllustration("clouds")).toBe("clouds-1");
    expect(resolveIllustration("weather")).toBe("clouds-1");
    expect(resolveIllustration("unicorn")).toBeNull();
    expect(resolveIllustration(undefined)).toBeNull();
    expect(illustrationSvg("nope-9")).toBeNull();
  });
});
