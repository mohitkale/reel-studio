import { describe, expect, it } from "vitest";

import {
  enrichScenePlan,
  repairChecklistScene,
  repairDataScene,
} from "./enrich-scene-plan";
import type { AIScene } from "@/providers/ai/types";

function scene(
  partial: Partial<AIScene> & Pick<AIScene, "text" | "templateId">,
): AIScene {
  return {
    emphasis: [],
    ...partial,
  };
}

describe("repairChecklistScene", () => {
  it("demotes a one-item icon-grid to kinetic", () => {
    const fixed = repairChecklistScene(
      scene({
        templateId: "icon-grid",
        text: "The real problem is you are measuring vanity metrics instead of retention.",
        visual: "✓",
      }),
    );
    expect(fixed.templateId).toBe("kinetic");
    expect(fixed.items).toBeUndefined();
  });

  it("demotes long checklist rows", () => {
    const fixed = repairChecklistScene(
      scene({
        templateId: "icon-grid",
        text: "Tips",
        items: [
          "First you should really take a long time to think about your audience deeply",
          "Then you should also rewrite the entire funnel from scratch somehow",
          "Finally ship something tiny",
        ],
        visual: "✓",
      }),
    );
    expect(fixed.templateId).toBe("kinetic");
  });

  it("keeps a proper short checklist", () => {
    const fixed = repairChecklistScene(
      scene({
        templateId: "icon-grid",
        text: "Do this",
        items: [
          "Talk to five users",
          "Ship a tiny test",
          "Measure real intent",
        ],
        visual: "✓",
      }),
    );
    expect(fixed.templateId).toBe("icon-grid");
    expect(fixed.items).toHaveLength(3);
  });
});

describe("enrichScenePlan", () => {
  it("repairs checklists before returning", () => {
    const out = enrichScenePlan(
      [
        scene({
          templateId: "icon-grid",
          text: "Only one long thought that should never be a checklist row at all",
        }),
      ],
      "remotion",
    );
    expect(out[0].templateId).toBe("kinetic");
  });

  it("turns B-roll beats into concrete video-first stock intent", () => {
    const out = enrichScenePlan(
      [
        scene({
          templateId: "hf-broll",
          text: "Engineers review calibrated software decisions together.",
        }),
      ],
      "hyperframes",
    );

    expect(out[0]).toMatchObject({
      templateId: "hf-broll",
      mediaKind: "video",
      backgroundQuery: expect.any(String),
    });
  });
});

describe("repairDataScene", () => {
  it("demotes a chart when no structured values were supplied", () => {
    const fixed = repairDataScene(
      scene({
        templateId: "hf-data-chart",
        text: "Retention improved after the onboarding change.",
      }),
    );

    expect(fixed.templateId).toBe("hf-statement");
    expect(fixed.chart).toBeUndefined();
  });

  it("keeps a chart whose labels and values are explicit", () => {
    const fixed = repairDataScene(
      scene({
        templateId: "hf-data-chart",
        text: "Weekly activation",
        chart: {
          labels: ["Week 1", "Week 2"],
          series: [{ label: "Activation", values: [42, 57], unit: "%" }],
          sourceAttribution: "Product analytics export",
        },
      }),
    );

    expect(fixed.templateId).toBe("hf-data-chart");
    expect(fixed.chart?.series[0].values).toEqual([42, 57]);
  });

  it("does not derive a metric from narration copy", () => {
    const fixed = repairDataScene(
      scene({
        templateId: "hf-money-count",
        text: "More than 10,000 people asked for this feature.",
      }),
    );

    expect(fixed.templateId).toBe("hf-statement");
    expect(fixed.visual).toBeUndefined();
  });
});
