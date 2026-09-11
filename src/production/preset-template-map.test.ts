import { describe, expect, it } from "vitest";

import { getVideoEngine } from "@/engines/registry";
import { ProductLaunchScene } from "@/compositions/presets/product-launch";
import { getPresetSceneComponent } from "@/compositions/presets/registry";
import { getProductionPreset } from "@/production/presets";
import { getPresetTemplateId } from "@/production/preset-template-map";

describe("Product Launch renderer adapters", () => {
  it("maps every role to a compatible template on both engines", () => {
    const preset = getProductionPreset("product-launch");
    expect(preset).toBeDefined();

    for (const engineId of ["hyperframes", "remotion"] as const) {
      const engine = getVideoEngine(engineId);
      for (const role of preset!.sceneRoles) {
        const templateId = getPresetTemplateId({
          presetId: "product-launch",
          engineId,
          role,
        });
        expect(templateId).toBeDefined();
        expect(engine.capabilities.templates[templateId!].sceneRoles).toContain(
          role,
        );
      }
    }
  });

  it("registers the Remotion preset renderer", () => {
    expect(getPresetSceneComponent("product-launch")).toBe(ProductLaunchScene);
  });
});
