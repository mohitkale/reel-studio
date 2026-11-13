import { describe, expect, it } from "vitest";

import { checkExamples, GOLDEN_COUNT } from "./examples-check";

describe("golden storyboards", () => {
  const { reports, problems } = checkExamples();

  it("are twelve, valid, with zero lint fixes, warnings or errors", () => {
    expect(reports).toHaveLength(GOLDEN_COUNT);
    expect(problems).toEqual([]);
  });

  it("mix portrait, landscape, square and a podcast, 20 to 90 seconds each", () => {
    expect(new Set(reports.map((r) => r.format).filter(Boolean))).toEqual(
      new Set(["9:16", "16:9", "1:1"]),
    );
    expect(reports.filter((r) => r.kind === "podcast")).toHaveLength(1);
    for (const r of reports.filter((r) => r.kind === "video")) {
      expect(r.seconds).toBeGreaterThanOrEqual(20);
      expect(r.seconds).toBeLessThanOrEqual(90);
    }
  });
});
