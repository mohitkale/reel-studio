import { describe, expect, it } from "vitest";
import {
  chapterPlanSchema,
  chapterPlanIssue,
  proposeChapterPlan,
  resolveChapters,
} from "@/production/chapters";
const scenes = Array.from({ length: 24 }, (_, index) => ({
  id: `scene-${index}`,
  text: `Original copy ${index}`,
}));
const timeline = scenes.map((scene, index) => ({
  sceneId: scene.id,
  startFrame: index * 150,
  durationFrames: 150,
}));
describe("bounded storyboard chapters", () => {
  it("suggests repeatable boundaries while preserving every scene and its timing", () => {
    const original = structuredClone({ scenes, timeline });
    const plan = proposeChapterPlan(scenes, timeline, 30);
    expect(plan).toEqual(proposeChapterPlan(scenes, timeline, 30));
    expect(plan.chapters.map((chapter) => chapter.firstSceneId)).toEqual([
      "scene-0",
      "scene-12",
    ]);
    const resolved = resolveChapters(
      plan,
      scenes.map((scene) => scene.id),
      timeline,
    );
    expect(
      resolved.chapters.map((chapter) => [
        chapter.startFrame,
        chapter.endFrame,
      ]),
    ).toEqual([
      [0, 1800],
      [1800, 3600],
    ]);
    expect(resolved.chapters.flatMap((chapter) => chapter.sceneIds)).toEqual(
      scenes.map((scene) => scene.id),
    );
    expect({ scenes, timeline }).toEqual(original);
  });
  it("bounds dense chapters even without word timing and rejects malformed boundaries", () => {
    const plan = proposeChapterPlan(scenes, [], 30);
    expect(plan.chapters.map((chapter) => chapter.firstSceneId)).toEqual([
      "scene-0",
      "scene-20",
    ]);
    const ids = scenes.map((scene) => scene.id);
    expect(
      chapterPlanIssue({ ...plan, chapters: [plan.chapters[0]] }, ids),
    ).toMatch(/20 scenes/);
    expect(
      chapterPlanIssue(
        { ...plan, chapters: [plan.chapters[1], plan.chapters[0]] },
        ids,
      ),
    ).toMatch(/first chapter/);
    expect(
      chapterPlanIssue(
        {
          ...plan,
          chapters: [
            plan.chapters[0],
            { ...plan.chapters[1], firstSceneId: "missing" },
          ],
        },
        ids,
      ),
    ).toMatch(/scene order/);
    expect(
      chapterPlanSchema.safeParse({
        ...plan,
        chapters: [plan.chapters[0], plan.chapters[0]],
      }).success,
    ).toBe(false);
    expect(() => proposeChapterPlan([], [], 30)).toThrow();
    expect(() => proposeChapterPlan(scenes, timeline, 0)).toThrow();
  });
  it("accepts the 240-scene structural ceiling without changing export limits", () => {
    const many = Array.from({ length: 240 }, (_, index) => ({
      id: `long-${index}`,
      text: "A longer story",
    }));
    const plan = proposeChapterPlan(many, [], 30);
    expect(plan.chapters).toHaveLength(12);
    expect(
      chapterPlanIssue(
        plan,
        many.map((scene) => scene.id),
      ),
    ).toBeUndefined();
    expect(() =>
      proposeChapterPlan([...many, { id: "overflow", text: "Extra" }], [], 30),
    ).toThrow();
  });
});
