import { describe, expect, it } from "vitest";
import {
  planMotionSequence,
  type MotionPlanScene,
  type MotionPlanSettings,
} from "./motion-plan";
import {
  defaultMotionSystem,
  motionSystemSchema,
  SYSTEM_TYPE_RECIPES,
} from "./motion-systems";
import { motionDirection, motionFallbackReason } from "./motion";

const scenes: MotionPlanScene[] = Array.from({ length: 12 }, (_, index) => ({
  role: index === 0 ? "hook" : "explanation",
  text: `Give this complete idea room to breathe ${index}.`,
}));
const settings: MotionPlanSettings = {
  version: "1.0.0",
  seed: "story",
  ambition: "expressive",
  system: "editorial",
};
describe("coherent visual families", () => {
  it("matches content direction and admits only curated systems", () => {
    expect(defaultMotionSystem("botanical")).toBe("editorial");
    expect(defaultMotionSystem("circuit")).toBe("precision");
    expect(defaultMotionSystem("signal")).toBe("poster");
    expect(motionSystemSchema.safeParse("random-css").success).toBe(false);
  });
  it("varies real layouts, freezes choices, and keeps append equivalent to whole planning", () => {
    const original = structuredClone(scenes);
    for (const system of ["editorial", "precision", "poster"] as const) {
      const plan = planMotionSequence(scenes, { ...settings, system });
      expect(
        new Set(plan.map((motion) => motion?.recipeId)).size,
      ).toBeGreaterThanOrEqual(3);
      expect(
        plan.every(
          (motion, index) =>
            index === 0 || motion?.recipeId !== plan[index - 1]?.recipeId,
        ),
      ).toBe(true);
      expect(
        plan.some((motion) =>
          SYSTEM_TYPE_RECIPES[system].includes(motion!.recipeId),
        ),
      ).toBe(true);
      expect(planMotionSequence(scenes, { ...settings, system })).toEqual(plan);
      expect([
        ...planMotionSequence(scenes.slice(0, 5), { ...settings, system }),
        ...planMotionSequence(
          scenes.slice(5),
          { ...settings, system },
          plan.slice(0, 5),
        ),
      ]).toEqual(plan);
      for (const [index, motion] of plan.entries())
        expect(
          motionFallbackReason(motion!, scenes[index].text),
        ).toBeUndefined();
    }
    expect(scenes).toEqual(original);
  });
  it("changes composition across seeds, while calm content avoids graphic hits", () => {
    const signatures = new Set(
      ["a", "b", "c", "d"].map((seed) =>
        planMotionSequence(scenes, { ...settings, seed })
          .map((motion) => motion?.recipeId)
          .join(","),
      ),
    );
    expect(signatures.size).toBeGreaterThan(1);
    const calm = planMotionSequence(
      scenes.map((scene) => ({ ...scene, energy: "calm" })),
      { ...settings, system: "poster", ambition: "clean" },
    );
    expect(
      calm.every(
        (motion) => !["type-poster", "type-impact"].includes(motion!.recipeId),
      ),
    ).toBe(true);
  });
  it("keeps exact structure, supplied media and explicit locks ahead of variety", () => {
    const input: MotionPlanScene[] = [
      {
        role: "feature",
        text: "Three ideas",
        items: ["Clear copy", "Useful motion", "Reading space"],
      },
      {
        role: "chart",
        text: "Supplied results",
        chart: {
          labels: ["A", "B"],
          series: [{ label: "Count", values: [0, 20] }],
        },
      },
      {
        role: "diagram",
        text: "A supplied hub",
        items: ["Core", "Copy", "Motion"],
        current: motionDirection("diagram-orbit"),
      },
      {
        role: "screenshot-demo",
        text: "Product",
        background: { type: "image", url: "supplied.png" },
      },
      {
        role: "hero",
        text: "Footage",
        background: { type: "video", url: "supplied.mp4" },
      },
      {
        role: "headline",
        text: "Locked",
        current: motionDirection("type-editorial"),
        locked: true,
      },
      { role: "headline", text: "Keep visual", hasVisualContent: true },
    ];
    const original = structuredClone(input);
    const planned = planMotionSequence(input, {
      ...settings,
      system: "precision",
    });
    expect(planned[0]?.recipeId).toBe("list-grid");
    expect(planned[1]?.recipeId).toBe("data-ledger");
    expect(planned[2]?.recipeId).toBe("diagram-orbit");
    expect(["media-device", "media-mat"]).toContain(planned[3]?.recipeId);
    expect(planned[4]?.recipeId).toBe("media-cinematic");
    expect(planned[5]).toEqual(input[5].current);
    expect(planned[6]).toBeUndefined();
    expect(input).toEqual(original);
  });
});
