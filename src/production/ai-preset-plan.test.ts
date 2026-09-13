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
