import { expect, it } from "vitest";
import { chapterPlanSchema, chapterPlanIssue } from "./chapters";
import { assertVideoDuration, videoDurationLimit } from "./limits";
import {
  assertLessonHtmlBudget,
  LONG_FORM_BUDGETS,
  lessonDirections,
} from "./long-form";
import { buildPrompt } from "@/providers/ai/prompt";

const chapters = [
  { id: "develop", title: "Develop", firstSceneId: "a" },
  { id: "recap", title: "Recap", firstSceneId: "b" },
];
const plan = chapterPlanSchema.parse({
  version: "1.0.0",
  longForm: { version: "1.0.0", targetSeconds: 600 },
  chapters: chapters.map((chapter, index) => ({
    ...chapter,
    direction: lessonDirections(chapters)[index],
  })),
});
it("requires explicit valid lesson direction for ten minutes and retains legacy limits", () => {
  const scenes = [{ id: "a" }, { id: "b" }];
  expect(videoDurationLimit({ fps: 24, scenes, chapterPlan: plan })).toBe(600);
  expect(
    videoDurationLimit({
      fps: 24,
      scenes,
      chapterPlan: { version: "1.0.0", chapters },
    }),
  ).toBe(300);
  expect(
    videoDurationLimit({
      fps: 24,
      scenes,
      chapterPlan: {
        ...plan,
        chapters: plan.chapters.map((chapter) => ({
          ...chapter,
          direction: undefined,
        })),
      },
    }),
  ).toBe(180);
  expect(() => assertVideoDuration(14_400, 24, 600)).not.toThrow();
  expect(() => assertVideoDuration(14_401, 24, 600)).toThrow(
    /including its cover/,
  );
  expect(() =>
    assertLessonHtmlBudget(LONG_FORM_BUDGETS.compiledHtmlBytes + 1),
  ).toThrow(/16 MiB/);
  expect(() =>
    chapterPlanSchema.parse({
      ...plan,
      longForm: { version: "2.0.0", targetSeconds: 900 },
    }),
  ).toThrow();
});
it("rejects missing, forward and self callbacks, preserving earlier references", () => {
  expect(chapterPlanIssue(plan, ["a", "b"])).toBeUndefined();
  expect(
    chapterPlanIssue(
      {
        ...plan,
        chapters: plan.chapters.map((chapter) => ({
          ...chapter,
          direction: {
            ...chapter.direction!,
            callbackChapterId: undefined,
            phase: "recap",
          },
        })),
      },
      ["a", "b"],
    ),
  ).toMatch(/recap must reference an earlier chapter/);
  expect(
    chapterPlanIssue(
      {
        ...plan,
        chapters: plan.chapters.map((chapter) => ({
          ...chapter,
          direction: { ...chapter.direction!, callbackChapterId: "recap" },
        })),
      },
      ["a", "b"],
    ),
  ).toMatch(/earlier chapter/);
  expect(() =>
    chapterPlanSchema.parse({
      ...plan,
      chapters: [
        { ...plan.chapters[0], direction: { goal: "Review", phase: "recap" } },
      ],
    }),
  ).toThrow(/earlier chapter/);
});
it("gives a chapter its own learning arc without repeating short-form hooks or CTAs", () => {
  const prompt = buildPrompt({
    mode: "append",
    brief: "Supplied explanation",
    chapterTitle: "Return",
    sceneCount: 4,
    chapterDirection: {
      goal: "Revisit the supplied process",
      phase: "recap",
      targetSeconds: 60,
    },
  });
  expect(prompt.system).toContain("one coherent chapter");
  expect(prompt.system).toContain("familiar subjects/diagrams");
  expect(prompt.system).not.toContain("they are scrolling");
  expect(prompt.system).not.toContain("Hook →");
  expect(prompt.user).not.toContain("Build one small arc");
  expect(prompt.system).toContain("150 spoken words per minute");
  expect(prompt.system).not.toContain("30 to 55 words");
  expect(
    buildPrompt({
      mode: "append",
      brief: "Continue the supplied process",
      chapterDirection: {
        goal: "Develop the saved argument",
        phase: "develop",
      },
    }).user,
  ).not.toContain("curiosity gap");
  expect(
    buildPrompt({ mode: "story", brief: "Short example" }).system,
  ).toContain("they are scrolling");
});
