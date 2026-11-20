import { describe, expect, it } from "vitest";

import type { AutomaticMediaDecision } from "@/library/automatic-stock-media";
import {
  MISSING_PICTURE_RULE,
  missingPictureWarnings,
} from "@/library/missing-pictures";
import { missingPictureFindings } from "@/storyboard/review";

const decision = (
  state: AutomaticMediaDecision["state"],
  extra: Partial<AutomaticMediaDecision> = {},
): AutomaticMediaDecision => ({
  state,
  attemptedProviders: [],
  message: "m",
  ...extra,
});

const storyboard = {
  kind: "video",
  scenes: [
    { type: "hook", headline: "Hello" },
    { type: "media", headline: "Sunrise", media: { query: "sunrise" } },
    { type: "media-split", headline: "Harbour", media: { query: "harbour" } },
    { type: "media", headline: "Found", media: { query: "found" } },
  ],
};

describe("missingPictureWarnings", () => {
  it("names each scene without a picture, with the reason for it", () => {
    const warnings = missingPictureWarnings(
      storyboard,
      [
        undefined,
        decision("no-provider"),
        decision("no-result"),
        decision("selected"),
      ],
      [false, false, false, true],
    );
    expect(warnings.map((w) => w.path)).toEqual([
      "scenes.1.media",
      "scenes.2.media",
    ]);
    expect(warnings.every((w) => w.rule === MISSING_PICTURE_RULE)).toBe(true);
    expect(warnings[0]!.message).toMatch(
      /^Scene 2 \(media\) has no picture: .*Pexels or Pixabay key.*shown as a statement/,
    );
    expect(warnings[1]!.message).toMatch(
      /Scene 3 \(media-split\).*no stock result for "harbour"/,
    );
  });

  it("says when a provider refused instead of finding nothing", () => {
    const [warning] = missingPictureWarnings(
      storyboard,
      [undefined, decision("no-result", { failedProviders: ["pexels"] })],
      [true, false],
    );
    expect(warning!.message).toMatch(/pexels refused or failed the search/);
  });

  it("is silent when every picture resolved, and for other kinds of storyboard", () => {
    expect(
      missingPictureWarnings(storyboard, [], [true, true, true, true]),
    ).toEqual([]);
    expect(missingPictureWarnings({ kind: "podcast" }, [], [])).toEqual([]);
  });
});

describe("missingPictureFindings", () => {
  it("turns the stored warnings into findings on 1-based scene numbers", () => {
    expect(
      missingPictureFindings([
        "scenes.2.media: Scene 3 (media) has no picture: no stock result. It is shown as a statement.",
        "scenes.0.headline: something else",
      ]),
    ).toEqual([
      {
        scene: 3,
        rule: "media-unresolved",
        suggestion:
          "Scene 3 (media) has no picture: no stock result. It is shown as a statement.",
      },
    ]);
  });
});
