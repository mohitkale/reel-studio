import { describe, expect, it } from "vitest";

import dataStoryFixture from "../../tests/fixtures/data-story-reel.json";
import productLaunchFixture from "../../tests/fixtures/product-launch-reel.json";
import releaseBriefs from "../../tests/fixtures/release-briefs.json";
import type { ReelProps } from "@/compositions/types";
import { applyReleaseBriefToFixture } from "../../scripts/release-brief-fixture";

describe("release brief render fixtures", () => {
  it("puts the complete selected brief into visible scene copy", () => {
    const brief = releaseBriefs["product-launch"][2];
    const result = applyReleaseBriefToFixture({
      fixture: productLaunchFixture as ReelProps,
      presetId: "product-launch",
      brief,
      briefIndex: 2,
    });
    expect(result.scenes.map((scene) => scene.text).join(" ")).toBe(brief);
    expect(result.captions?.cues.map((cue) => cue.text).join(" ")).toBe(brief);
  });

  it("preserves the exact supplied data and attribution for every data brief", () => {
    const expected = [
      { values: [120, 180], source: "Supplied project log" },
      { values: [18, 11], source: "Supplied review audit" },
      { values: [24, 21, 19], source: "Supplied test batch" },
    ];
    for (const [briefIndex, brief] of releaseBriefs["data-story"].entries()) {
      const result = applyReleaseBriefToFixture({
        fixture: dataStoryFixture as ReelProps,
        presetId: "data-story",
        brief,
        briefIndex,
      });
      const charts = result.scenes.flatMap((scene) =>
        scene.chart ? [scene.chart] : [],
      );
      expect(charts.length).toBeGreaterThan(0);
      expect(charts[0].series[0].values).toEqual(expected[briefIndex].values);
      expect(charts[0].sourceAttribution).toBe(expected[briefIndex].source);
    }
  });
});
