import { describe, expect, it } from "vitest";
import { analyzeBeat, directScene, groundSceneData } from "./director";
import { createDeterministicProductionPlan } from "./manual-planner";
import { applyPresetToAIPlan } from "./ai-preset-plan";
import { scenePlanSchema } from "@/providers/ai/types";
import { planMotionSequence } from "./motion-plan";
import {
  shotDirectionSchema,
  directorBudgetSchema,
} from "@/video/shot-direction";
import { directorFixture } from "../../tests/fixtures/director";

const scene = (text: string) => ({
  text,
  templateId: "hf-statement" as const,
  emphasis: [],
});
describe("source-grounded director", () => {
  it("retains structural paragraphs containing short bullet rows in the real no-key pipeline", () => {
    const result = directorFixture();
    expect(result.scenes.map((value) => value.role)).toEqual([
      "metric",
      "chart",
      "diagram",
      "quote",
      "comparison",
    ]);
    expect(result.scenes[2].items).toEqual(["Capture", "Review", "Export"]);
  });
  it("recognizes supplied metrics, labeled data, lists, quotes and comparisons", () => {
    expect(analyzeBeat("Completion reached 42%.")).toMatchObject({
      kind: "metric",
      visual: "42%",
    });
    expect(analyzeBeat("Alpha: 42%; Beta: 57%")).toMatchObject({
      kind: "chart",
      chart: {
        labels: ["Alpha", "Beta"],
        series: [{ values: [42, 57], unit: "%" }],
      },
    });
    expect(analyzeBeat("- Capture\n- Review\n- Export")).toMatchObject({
      kind: "list",
      items: ["Capture", "Review", "Export"],
    });
    expect(analyzeBeat("She said “Keep every supplied word.”")).toMatchObject({
      kind: "quote",
      emphasis: ["Keep every supplied word."],
    });
    expect(analyzeBeat("Manual editing versus guided creation")).toMatchObject({
      kind: "comparison",
      items: ["Manual editing", "guided creation"],
    });
    expect(analyzeBeat("In 2024, we learned 3 lessons.").kind).toBe("prose");
  });
  it("does not fabricate a dataset from unrelated numbers or mixed units", () => {
    expect(
      analyzeBeat("42 people tried it and 57 liked it.").chart,
    ).toBeUndefined();
    expect(analyzeBeat("Alpha: 42%; Beta: 57").chart).toBeUndefined();
    const chart = analyzeBeat("Alpha: 42%; Beta: 57%").chart;
    expect(
      groundSceneData(
        { ...scene("Measured outcomes"), chart },
        "Alpha: 420%; Beta: 57%",
      ).chart,
    ).toBeUndefined();
    expect(
      groundSceneData(
        { ...scene("Measured outcomes"), chart },
        "Alpha: 42%; Beta: 57%",
      ).chart,
    ).toEqual(chart);
    expect(
      groundSceneData(
        { ...scene("Outcome"), visual: "42%" },
        "The result is 420%.",
      ).visual,
    ).toBeUndefined();
    expect(
      groundSceneData(
        { ...scene("Outcome"), visual: "42%" },
        "The result is 42%.",
      ).visual,
    ).toBe("42%");
  });
  it("rejects an invented factual series name even when its values match", () => {
    const chart = {
      labels: ["Alpha", "Beta"],
      series: [{ label: "Revenue growth", values: [42, 57], unit: "%" }],
    };
    expect(
      groundSceneData({ ...scene("Outcomes"), chart }, "Alpha: 42%; Beta: 57%")
        .chart,
    ).toBeUndefined();
    expect(
      groundSceneData(
        { ...scene("Outcomes"), chart },
        "Revenue growth\nAlpha: 42%; Beta: 57%",
      ).chart,
    ).toEqual(chart);
  });
  it("persists content choices through the no-key Quick Produce preset adapter", () => {
    for (const [source, role] of [
      ["Alpha: 42%; Beta: 57%", "chart"],
      ["- Capture\n- Review\n- Export", "diagram"],
      ["“Keep every supplied word.”", "quote"],
      ["Manual editing versus guided creation", "comparison"],
      ["Completion reached 42%.", "metric"],
    ]) {
      const result = createDeterministicProductionPlan({
        name: "Source",
        text: source,
        presetId: "editorial-explainer",
        videoEngine: "hyperframes",
        hasVisualAsset: false,
      });
      const adapted = applyPresetToAIPlan(
        result.plan,
        "editorial-explainer",
        "hyperframes",
        { source },
      );
      expect(adapted.roles[0]).toBe(role);
      expect(adapted.plan.scenes[0].direction?.role).toBe(role);
      expect(
        adapted.plan.scenes[0].spokenText ?? adapted.plan.scenes[0].text,
      ).toBe(source);
    }
  });
  it("rejects fabricated AI data even when the scene itself repeats the numbers", () => {
    const plan = scenePlanSchema.parse({
      projectName: "Plan",
      scriptName: "Script",
      scenes: [scene("Alpha: 42%; Beta: 57%")],
    });
    const directed = applyPresetToAIPlan(plan, "data-story", "hyperframes", {
      source: "A qualitative finding without measurements.",
    });
    expect(directed.plan.scenes[0].chart).toBeUndefined();
    expect(directed.plan.scenes[0].templateId).toBe("hf-statement");
    expect(directed.roles).toEqual(["explanation"]);
  });
  it("admits constrained AI direction only when factual/layout inputs fit", () => {
    const direction = shotDirectionSchema.parse({
      version: 1,
      role: "headline",
      composition: "layered-title",
      motion: { recipeId: "data-bars", version: "1.0.0" },
    });
    expect(
      directScene({ ...scene("A clear idea"), direction }, "hook").direction,
    ).toEqual({
      version: 1,
      role: "headline",
      composition: "layered-title",
    });
    expect(
      directScene({ ...scene("A clear idea"), direction }, "hook", true)
        .direction.composition,
    ).toBe("authored");
    expect(
      shotDirectionSchema.safeParse({ ...direction, html: "<script>" }).success,
    ).toBe(false);
    expect(directorBudgetSchema.safeParse({ maxPaidCalls: 2 }).success).toBe(
      false,
    );
  });
  it("keeps supplied copy and seeds stable across repeated planning", () => {
    const args = {
      name: "A source",
      text: "Completion reached 42%. A clear useful conclusion follows.",
      presetId: "creator-punch" as const,
      videoEngine: "hyperframes" as const,
      hasVisualAsset: false,
    };
    const first = createDeterministicProductionPlan(args);
    expect(createDeterministicProductionPlan(args)).toEqual(first);
    const inputs = first.plan.scenes.map((value, i) => ({
      ...value,
      role: first.roles[i],
    }));
    const settings = {
      version: "1.0.0" as const,
      seed: "source-42",
      ambition: "expressive" as const,
    };
    expect(planMotionSequence(inputs, settings)).toEqual(
      planMotionSequence(inputs, settings),
    );
  });
});
