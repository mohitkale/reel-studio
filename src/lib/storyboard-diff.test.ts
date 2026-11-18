import { expect, it } from "vitest";

import { diffStoryboards } from "@/lib/storyboard-diff";

const sb = (...heads: string[]) => ({
  title: "T",
  scenes: heads.map((headline) => ({
    type: "statement",
    headline,
    narration: `${headline} narration`,
  })),
});

it("finds nothing when nothing changed", () => {
  expect(diffStoryboards(sb("A", "B"), sb("A", "B")).scenes).toEqual([]);
});

it("reports a changed headline and narration per scene", () => {
  const changes = diffStoryboards(sb("A", "B"), sb("A", "Better")).scenes;
  expect(changes.map((c) => `${c.index}:${c.field}`)).toEqual([
    "1:headline",
    "1:narration",
  ]);
  expect(changes[0]).toMatchObject({ before: "B", after: "Better" });
});

it("reports added and removed scenes and a new title", () => {
  const added = diffStoryboards(sb("A"), sb("A", "B"));
  expect(added.scenes).toEqual([{ index: 1, kind: "added", after: "B" }]);
  const removed = diffStoryboards(sb("A", "B"), sb("A"));
  expect(removed.scenes).toEqual([{ index: 1, kind: "removed", before: "B" }]);
  const renamed = diffStoryboards(
    { title: "Old", scenes: [] },
    { title: "New", scenes: [] },
  );
  expect(renamed.title).toEqual({ before: "Old", after: "New" });
});
