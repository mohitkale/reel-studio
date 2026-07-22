import { describe, expect, it } from "vitest";

import { enrichScenePlan, repairChecklistScene } from "./enrich-scene-plan";
import type { AIScene } from "@/providers/ai/types";

function scene(partial: Partial<AIScene> & Pick<AIScene, "text" | "templateId">): AIScene {
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
        items: ["Talk to five users", "Ship a tiny test", "Measure real intent"],
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
});
