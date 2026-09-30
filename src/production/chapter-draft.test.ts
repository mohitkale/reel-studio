import { expect, it } from "vitest";
import {
  chapterDraftSchema,
  chapterDraftCapacityIssue,
  pendingChapterDraftIssue,
} from "./chapter-draft";
import { chapterDraftRequestSchema } from "@/library/chapter-draft-input";
const script = {
  scenes: [{ id: "start" }],
  chapterPlan: {
    version: "1.0.0" as const,
    chapters: [{ id: "intro", title: "Intro", firstSceneId: "start" }],
  },
};
export const draft = {
  version: "1.0.0",
  topic: "Supplied topic",
  chapters: [
    {
      id: "draft-1",
      title: "Question",
      brief: "Explain the supplied question",
      sceneCount: 4,
    },
  ],
};
it("validates bounded writing drafts and unique stable chapter IDs", () => {
  expect(chapterDraftSchema.parse(draft)).toEqual(draft);
  for (const change of [
    { chapters: [] },
    { topic: " " },
    { chapters: [draft.chapters[0], draft.chapters[0]] },
    { chapters: [{ ...draft.chapters[0], sceneCount: 21 }] },
    { chapters: [{ ...draft.chapters[0], title: "x".repeat(121) }] },
    { chapters: [{ ...draft.chapters[0], brief: "x".repeat(2001) }] },
    { arbitraryCode: "run this" },
  ])
    expect(chapterDraftSchema.safeParse({ ...draft, ...change }).success).toBe(
      false,
    );
});
it("checks existing outline and total planned capacity without losing existing content", () => {
  expect(chapterDraftCapacityIssue(script, [20, 20])).toBeUndefined();
  expect(chapterDraftCapacityIssue(script, Array(12).fill(1))).toContain(
    "12 chapters",
  );
  expect(
    chapterDraftCapacityIssue(
      {
        ...script,
        scenes: Array.from({ length: 240 }, (_, index) => ({
          id: index ? `${index}` : "start",
        })),
        chapterPlan: undefined,
      },
      [1],
    ),
  ).toContain("valid chapter outline");
  expect(chapterDraftCapacityIssue(script, [21])).toContain("1–20");
  expect(
    chapterDraftCapacityIssue(
      {
        ...script,
        chapterPlan: {
          ...script.chapterPlan,
          chapters: [
            { ...script.chapterPlan.chapters[0], firstSceneId: "missing" },
          ],
        },
      },
      [1],
    ),
  ).toContain("Update the chapter outline");
  const large = {
    scenes: Array.from({ length: 220 }, (_, index) => ({ id: `${index}` })),
    chapterPlan: {
      version: "1.0.0" as const,
      chapters: Array.from({ length: 11 }, (_, index) => ({
        id: `${index}`,
        title: "Chapter",
        firstSceneId: `${index * 20}`,
      })),
    },
  };
  expect(chapterDraftCapacityIssue(large, [20])).toBeUndefined();
  expect(chapterDraftCapacityIssue(large, [1, 1])).toContain("12 chapters");
  expect(
    chapterDraftCapacityIssue(
      { scenes: [], chapterPlan: undefined },
      Array(12).fill(20),
    ),
  ).toBeUndefined();
});
it("rejects out-of-policy topic requests before generation", () => {
  const input = {
    providerId: "openai",
    topic: "A topic",
    chapterCount: 2,
    scenesPerChapter: 4,
  };
  expect(chapterDraftRequestSchema.safeParse(input).success).toBe(true);
  for (const change of [
    { chapterCount: 13 },
    { scenesPerChapter: 21 },
    { topic: "a" },
    { durationLimit: 900 },
  ])
    expect(
      chapterDraftRequestSchema.safeParse({ ...input, ...change }).success,
    ).toBe(false);
});

it("counts only pending capacity and rejects corrupt or missing generated progress", () => {
  const scenes = Array.from({ length: 220 }, (_, index) => ({
    id: `${index}`,
  }));
  const chapterPlan = {
    version: "1.0.0" as const,
    chapters: Array.from({ length: 11 }, (_, index) => ({
      id: `${index}`,
      title: "Chapter",
      firstSceneId: `${index * 20}`,
    })),
  };
  const saved = chapterDraftSchema.parse({
    ...draft,
    chapters: [
      {
        ...draft.chapters[0],
        sceneCount: 20,
        generated: {
          chapterId: "10",
          sceneIds: scenes.slice(200).map((scene) => scene.id),
        },
      },
      { ...draft.chapters[0], id: "pending", sceneCount: 20 },
    ],
  });
  expect(
    pendingChapterDraftIssue({ scenes, chapterPlan }, saved),
  ).toBeUndefined();
  expect(
    pendingChapterDraftIssue(
      { scenes: scenes.slice(0, -1), chapterPlan },
      saved,
    ),
  ).toContain("lost scenes");
  for (const chapters of [
    [...saved.chapters].reverse(),
    [{ ...saved.chapters[0], sceneCount: 19 }],
    [
      {
        ...saved.chapters[0],
        generated: { chapterId: "10", sceneIds: Array(20).fill("200") },
      },
    ],
  ])
    expect(chapterDraftSchema.safeParse({ ...saved, chapters }).success).toBe(
      false,
    );
});
