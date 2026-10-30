import { describe, expect, it } from "vitest";

import {
  allowedPresetTemplateIds,
  applyPresetToAIPlan,
  resolvePresetRoles,
} from "@/production/ai-preset-plan";
import { scenePlanSchema } from "@/providers/ai/types";

const plan = scenePlanSchema.parse({
  projectName: "Launch",
  scriptName: "A useful launch",
  scenes: Array.from({ length: 5 }, (_, index) => ({
    templateId: "kinetic",
    text: `Supplied idea ${index + 1}`,
    emphasis: ["Supplied"],
  })),
});

describe("AI production preset planning", () => {
  it("admits a chart from one evidence excerpt without combining unrelated sources", () => {
    const researched = scenePlanSchema.parse({
      ...plan,
      scenes: [
        {
          templateId: "hf-data-chart",
          text: "Compare results.",
          emphasis: [],
          chart: {
            labels: ["Draft", "Release"],
            series: [{ label: "Supplied values", values: [42, 91], unit: "%" }],
          },
        },
      ],
    });
    const apply = (evidenceSources: string[]) =>
      applyPresetToAIPlan(researched, "data-story", "hyperframes", {
        source: "Compare results",
        evidenceSources,
      }).plan.scenes[0].chart;
    expect(apply(["Draft: 42%\nRelease: 91%"])).toEqual(
      researched.scenes[0].chart,
    );
    expect(apply(["Draft: 42%", "Release: 91%"])).toBeUndefined();
    expect(apply(["Draft: 42%\nRelease: 90%"])).toBeUndefined();
  });
  it("shows a requested literal dataset even when AI returned only prose, without inventing missing values", () => {
    const source =
      "Show the results in a chart.\nDraft: 42%\nReview: 68%\nRelease: 91%";
    const result = applyPresetToAIPlan(plan, "data-story", "hyperframes", {
      source,
    });
    const middle = result.plan.scenes[2];
    expect(result.roles[2]).toBe("chart");
    expect(middle.templateId).toBe("hf-data-chart");
    expect(middle.text).toBe(plan.scenes[2].text);
    expect(middle.chart?.labels).toEqual(["Draft", "Review", "Release"]);
    expect(middle.chart?.series[0].values).toEqual([42, 68, 91]);
    expect(middle.chart?.series[0].unit).toBe("%");
    for (const incomplete of [
      "Draw a chart with improving results",
      "Show a chart.\nDraft: 42%\nReview: 68",
    ]) {
      expect(
        applyPresetToAIPlan(plan, "data-story", "hyperframes", {
          source: incomplete,
        }).plan.scenes.some((scene) => scene.chart),
      ).toBe(false);
    }
  });
  it("preserves a grounded chart with prose copy instead of remapping it to a stat template", () => {
    const supplied = scenePlanSchema.parse({
      ...plan,
      scenes: [
        {
          templateId: "hf-data-chart",
          text: "Compare the supplied results.",
          emphasis: [],
          chart: {
            labels: ["Draft", "Release"],
            series: [{ label: "Supplied values", values: [42, 91], unit: "%" }],
          },
        },
      ],
    });
    const result = applyPresetToAIPlan(supplied, "data-story", "hyperframes", {
      source: "Draft: 42%\nRelease: 91%",
    });
    expect(result.roles).toEqual(["chart"]);
    expect(result.plan.scenes[0].templateId).toBe("hf-data-chart");
    expect(result.plan.scenes[0].chart).toEqual(supplied.scenes[0].chart);
  });
  it("maps every generated scene to a template supported by its preset and engine", () => {
    const result = applyPresetToAIPlan(plan, "product-launch", "hyperframes", {
      hasVisualAsset: true,
    });
    const allowed = allowedPresetTemplateIds("product-launch", "hyperframes");

    expect(result.roles).toEqual([
      "hook",
      "screenshot-demo",
      "feature",
      "comparison",
      "cta",
    ]);
    expect(
      result.plan.scenes.every((scene) => allowed.includes(scene.templateId)),
    ).toBe(true);
  });

  it("uses a prose-safe template when a structural preset slot has no inputs", () => {
    const result = applyPresetToAIPlan(plan, "product-launch", "hyperframes", {
      hasVisualAsset: false,
    });
    expect(result.roles).not.toContain("comparison");
    expect(
      result.plan.scenes.some((scene) => scene.templateId === "hf-statement"),
    ).toBe(true);
    expect(
      result.plan.scenes.every((scene) =>
        allowedPresetTemplateIds("product-launch", "hyperframes").includes(
          scene.templateId,
        ),
      ),
    ).toBe(true);
  });

  it("does not assign media-dependent roles without supplied visual media", () => {
    expect(
      resolvePresetRoles("developer-demo", 8, {
        hasVisualAsset: false,
      }),
    ).not.toContain("browser");
    expect(
      resolvePresetRoles("cinematic-brand", 6, {
        hasVisualAsset: false,
      }),
    ).not.toContain("hero");
  });

  it("falls back from a B-roll template when that scene has no resolved media", () => {
    const result = applyPresetToAIPlan(plan, "product-launch", "hyperframes", {
      hasVisualAsset: true,
      sceneHasVisual: [false, true, false, true, false],
    });

    expect(result.plan.scenes[2]?.templateId).toBe("hf-statement");
  });

  it("uses continuation roles for appended scenes and prose-safe data roles", () => {
    expect(
      resolvePresetRoles("product-launch", 4, {
        hasVisualAsset: true,
        continuation: true,
      }),
    ).toEqual(["screenshot-demo", "feature", "comparison", "screenshot-demo"]);
    expect(resolvePresetRoles("data-story", 3)).toEqual([
      "takeaway",
      "takeaway",
      "takeaway",
    ]);
  });
});
