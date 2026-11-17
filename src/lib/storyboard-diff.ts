/** What changed between two storyboards, scene by scene, in words a person can check. */
export interface SceneLike {
  type?: unknown;
  headline?: unknown;
  narration?: unknown;
}

export interface StoryboardLike {
  title?: unknown;
  scenes?: SceneLike[];
}

export interface SceneChange {
  index: number;
  kind: "changed" | "added" | "removed";
  field?: "headline" | "narration" | "type";
  before?: string;
  after?: string;
}

const text = (value: unknown) => (typeof value === "string" ? value : "");

export function diffStoryboards(
  before: StoryboardLike,
  after: StoryboardLike,
): { title?: { before: string; after: string }; scenes: SceneChange[] } {
  const a = before.scenes ?? [];
  const b = after.scenes ?? [];
  const scenes: SceneChange[] = [];
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    if (i >= a.length) {
      scenes.push({ index: i, kind: "added", after: text(b[i].headline) });
    } else if (i >= b.length) {
      scenes.push({ index: i, kind: "removed", before: text(a[i].headline) });
    } else {
      for (const field of ["type", "headline", "narration"] as const) {
        if (text(a[i][field]) !== text(b[i][field])) {
          scenes.push({
            index: i,
            kind: "changed",
            field,
            before: text(a[i][field]),
            after: text(b[i][field]),
          });
        }
      }
    }
  }
  const titleChanged = text(before.title) !== text(after.title);
  return {
    ...(titleChanged
      ? { title: { before: text(before.title), after: text(after.title) } }
      : {}),
    scenes,
  };
}
