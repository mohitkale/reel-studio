import { describe, expect, it } from "vitest";

import { hasIcon, iconForScene, iconNames, iconSvg } from "./icons";
import { SCENE_TYPES } from "@/storyboard";

describe("bundled icons", () => {
  it("ships a curated lucide set as inline svg", () => {
    expect(iconNames().length).toBeGreaterThan(100);
    expect(iconSvg("moon")).toContain("<svg");
    expect(iconSvg("no-such-icon")).toContain("<svg");
  });

  it("picks from the words, deterministically", () => {
    expect(
      iconForScene({ text: "Sleep well tonight", type: "statement" }),
    ).toBe("moon");
    expect(
      iconForScene({ text: "Sleep well tonight", type: "statement" }),
    ).toBe("moon");
  });

  it("honours a valid explicit icon and ignores an invalid one", () => {
    expect(iconForScene({ text: "anything", explicit: "rocket" })).toBe(
      "rocket",
    );
    expect(
      hasIcon(
        iconForScene({ text: "anything", explicit: "nonsense", type: "cta" }),
      ),
    ).toBe(true);
  });

  it("always has an icon for every scene type", () => {
    for (const type of SCENE_TYPES)
      expect(hasIcon(iconForScene({ text: "zzz", type }))).toBe(true);
  });
});
