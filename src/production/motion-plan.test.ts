import { describe, expect, it } from "vitest";
import { motionDirection, motionFallbackReason } from "@/production/motion";
import {
  planMotionSequence,
  motionPlanSettingsSchema,
  type MotionPlanScene,
  type MotionPlanSettings,
} from "@/production/motion-plan";

const settings: MotionPlanSettings = {
  version: "1.0.0",
  seed: "production-1",
  ambition: "expressive",
};
const readingScenes: MotionPlanScene[] = Array.from(
  { length: 24 },
  (_, index) => ({
    text: `One clear idea ${index}`,
    role: "headline",
  }),
);

describe("sequence motion direction", () => {
  it("freezes deterministic decisions and continues the same rhythm on append", () => {
    const whole = planMotionSequence(readingScenes, settings);
    const first = planMotionSequence(readingScenes.slice(0, 7), settings);
    expect([
      ...first,
      ...planMotionSequence(readingScenes.slice(7), settings, first),
    ]).toEqual(whole);
    expect(
      planMotionSequence(structuredClone(readingScenes), settings),
    ).toEqual(whole);
    expect(new Set(whole.map((motion) => motion?.recipeId)).size).toBe(2);
  });

  it("reserves bold type for anchors in Clean and adds hits in Showcase", () => {
    const clean = planMotionSequence(readingScenes, {
      ...settings,
      ambition: "clean",
    });
    expect(clean.every((motion) => motion?.recipeId === "type-editorial")).toBe(
      true,
    );
    const showcase = planMotionSequence(readingScenes, {
      ...settings,
      ambition: "showcase",
    });
    expect(
      showcase.filter((motion) => motion?.recipeId === "type-impact").length,
    ).toBeGreaterThan(0);
    const expressive = planMotionSequence(readingScenes, settings);
    expect(
      showcase.filter((motion) => motion?.recipeId === "type-impact").length,
    ).toBeGreaterThan(
      expressive.filter((motion) => motion?.recipeId === "type-impact").length,
    );
    expect(
      showcase.every(
        (motion, index) =>
          index === 0 ||
          motion?.recipeId !== "type-impact" ||
          showcase[index - 1]?.recipeId !== "type-impact",
      ),
    ).toBe(true);
    expect(
      planMotionSequence(
        [
          { role: "hook", text: "Opening" },
          { role: "headline", text: "Context" },
          { role: "payoff", text: "Resolution" },
        ],
        { ...settings, ambition: "clean" },
      ).map((motion) => motion?.recipeId),
    ).toEqual(["type-impact", "type-editorial", "type-impact"]);
  });

  it("counts quiet preset beats rather than carrying the last recipe forever", () => {
    expect(
      planMotionSequence([{ role: "hook", text: "Opening" }], settings, [
        motionDirection("type-impact"),
      ])[0]?.recipeId,
    ).toBe("type-editorial");
    expect(
      planMotionSequence([{ role: "hook", text: "Opening" }], settings, [
        motionDirection("type-impact"),
        undefined,
        undefined,
        undefined,
      ])[0]?.recipeId,
    ).toBe("type-impact");
  });

  it("keeps semantic roles, values and authored diagram meaning ahead of variety", () => {
    const image = { type: "image" as const, url: "/media/product.png" };
    const scenes: MotionPlanScene[] = [
      {
        role: "diagram",
        text: "First steps",
        items: ["Prepare", "Build", "Review"],
      },
      {
        role: "diagram",
        text: "Next steps",
        items: ["Capture", "Render", "Publish"],
      },
      {
        role: "diagram",
        text: "Connections",
        items: ["Core", "Design", "Audio"],
        current: motionDirection("diagram-orbit"),
      },
      { role: "screenshot-demo", text: "Dashboard", background: image },
      { role: "hero", text: "Cover", background: image },
      {
        role: "chart",
        text: "Supplied values",
        chart: {
          labels: ["A", "B"],
          series: [{ label: "Result", values: [18, 42], unit: "%" }],
        },
      },
      { role: "metric", text: "No supplied values" },
      {
        role: "hook",
        text: "Video",
        background: { type: "video", url: "/media/clip.mp4" },
      },
      { role: "hook", text: "Other visual", hasVisualContent: true },
      { role: "hook", text: "Too much copy".repeat(40) },
    ];
    const before = structuredClone(scenes);
    const planned = planMotionSequence(scenes, settings);
    expect(planned.map((motion) => motion?.recipeId)).toEqual([
      "diagram-path",
      "diagram-path",
      "diagram-orbit",
      "media-device",
      "media-cinematic",
      "data-bars",
      undefined,
      undefined,
      undefined,
      undefined,
    ]);
    for (const [index, motion] of planned.entries()) {
      if (!motion) continue;
      const scene = scenes[index];
      expect(
        motionFallbackReason(
          motion,
          scene.text,
          scene.chart,
          scene.hasVisualContent,
          scene.items,
          scene.background,
        ),
      ).toBeUndefined();
    }
    expect(scenes).toEqual(before);
  });

  it("preserves locked direction including an intentional preset look", () => {
    const chosen = motionDirection("type-impact");
    expect(
      planMotionSequence(
        [
          {
            text: "Protected",
            role: "headline",
            current: chosen,
            locked: true,
          },
          { text: "Preset look", role: "hook", locked: true },
        ],
        settings,
      ),
    ).toEqual([chosen, undefined]);
  });

  it("uses seeds for real layout variation while rejecting unsupported settings", () => {
    const featureScenes: MotionPlanScene[] = [
      {
        role: "feature",
        text: "Product view",
        background: { type: "image", url: "/media/view.png" },
      },
    ];
    const choices = new Set(
      ["a", "b", "c", "d"].map(
        (seed) =>
          planMotionSequence(featureScenes, { ...settings, seed })[0]?.recipeId,
      ),
    );
    expect(choices.size).toBe(2);
    expect(
      motionPlanSettingsSchema.safeParse({ ...settings, version: "99.0.0" })
        .success,
    ).toBe(false);
    expect(
      motionPlanSettingsSchema.safeParse({ ...settings, ambition: "random" })
        .success,
    ).toBe(false);
  });
});
