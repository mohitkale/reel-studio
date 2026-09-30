import { expect, it } from "vitest";
import { prepareSceneAppendScope } from "./scene-append-scope";
import { aiEnhanceRequestSchema } from "./ai-enhance-input";
import type { ChapterPlan } from "@/production/chapters";

function draft(count = 24) {
  const scenes = Array.from({ length: count }, (_, index) => ({
    id: `scene-${index}`,
    text: `Original ${index} ${"x".repeat(2000)}`,
    spokenText: `Voice ${index} ${"y".repeat(4000)}`,
  }));
  const chapterPlan: ChapterPlan = {
    version: "1.0.0",
    chapters: Array.from({ length: Math.ceil(count / 20) }, (_, index) => ({
      id: `chapter-${index}`,
      title: `Chapter ${index}`,
      firstSceneId: `scene-${index * 20}`,
    })),
  };
  return { scenes, chapterPlan };
}
it("sends only two bounded neighboring excerpts and saved chapter titles", () => {
  const { context } = prepareSceneAppendScope(draft(220), {
    chapterTitle: "Next",
    sceneCount: 20,
  });
  expect(context).toContain("Chapter 10");
  expect(context).toContain("Original 218");
  expect(context).toContain("Voice 219");
  expect(context).not.toContain("Original 217");
  expect(context.length).toBeLessThan(4000);
});
it("validates outline, chapter and scene capacities before generation, including ordinary append", () => {
  expect(() =>
    prepareSceneAppendScope(draft(), { chapterTitle: "Next", sceneCount: 20 }),
  ).not.toThrow();
  for (const [script, input] of [
    [{ ...draft(), chapterPlan: undefined }, { chapterTitle: "Next" }],
    [
      {
        ...draft(),
        chapterPlan: {
          ...draft().chapterPlan,
          chapters: [draft().chapterPlan.chapters[0]],
        },
      },
      { chapterTitle: "Next" },
    ],
    [draft(240), { chapterTitle: "Next", sceneCount: 1 }],
    [draft(221), { chapterTitle: "Next", sceneCount: 1 }],
    [draft(239), { sceneCount: 2 }],
    [draft(20), {}],
    [draft(), { chapterTitle: " " }],
    [draft(), { chapterTitle: "x".repeat(121) }],
    [draft(), { sceneCount: 21 }],
  ] as Array<
    [
      Parameters<typeof prepareSceneAppendScope>[0],
      Parameters<typeof prepareSceneAppendScope>[1],
    ]
  >)
    expect(() => prepareSceneAppendScope(script, input)).toThrow();
  expect(() =>
    prepareSceneAppendScope(draft(239), { sceneCount: 1 }),
  ).not.toThrow();
  expect(() =>
    prepareSceneAppendScope({ ...draft(20), chapterPlan: undefined }, {}),
  ).not.toThrow();
});
it("shares trimmed titles and the 1–20 request bound", () => {
  const body = {
    providerId: "openai",
    mode: "append",
    brief: "Explain the next topic",
    sceneCount: 1,
    chapterTitle: "  Proof  ",
  };
  expect(aiEnhanceRequestSchema.parse(body)).toMatchObject({
    chapterTitle: "Proof",
    mediaPreference: "auto",
  });
  for (const chapterTitle of [" ", "x".repeat(121)])
    expect(
      aiEnhanceRequestSchema.safeParse({ ...body, chapterTitle }).success,
    ).toBe(false);
});
