import { describe, expect, it } from "vitest";

import { NICHE_COUNT, checkNiches, readNicheIndex } from "./niches-check";

describe("the niche showcase", () => {
  const { reports, problems } = checkNiches();

  it("has thirty storyboards that lint clean, with sources where they state facts", () => {
    expect(reports).toHaveLength(NICHE_COUNT);
    expect(problems).toEqual([]);
  });

  it("gives every storyboard a brief and a reproducible command source", () => {
    for (const entry of readNicheIndex().entries) {
      expect(entry.brief.length).toBeGreaterThan(40);
      expect(entry.file).toMatch(/^[a-z]+-[a-z0-9-]+\.json$/);
    }
  });
});
