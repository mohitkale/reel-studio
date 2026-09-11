import { describe, expect, it } from "vitest";

import { getVideoEngine } from "@/engines/registry";
import { ProductLaunchScene } from "@/compositions/presets/product-launch";
import { EditorialExplainerScene } from "@/compositions/presets/editorial-explainer";
import { CreatorPunchScene } from "@/compositions/presets/creator-punch";
import { DataStoryScene } from "@/compositions/presets/data-story";
import { DeveloperDemoScene } from "@/compositions/presets/developer-demo";
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

describe("Editorial Explainer renderer adapters", () => {
  it("maps every role to a compatible template on both engines", () => {
    const preset = getProductionPreset("editorial-explainer");
    expect(preset).toBeDefined();

    for (const engineId of ["hyperframes", "remotion"] as const) {
      const engine = getVideoEngine(engineId);
      for (const role of preset!.sceneRoles) {
        const templateId = getPresetTemplateId({
          presetId: "editorial-explainer",
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
    expect(getPresetSceneComponent("editorial-explainer")).toBe(
      EditorialExplainerScene,
    );
  });
});

describe("Creator Punch renderer adapters", () => {
  it("maps every role to a compatible template on both engines", () => {
    const preset = getProductionPreset("creator-punch");
    expect(preset).toBeDefined();

    for (const engineId of ["hyperframes", "remotion"] as const) {
      const engine = getVideoEngine(engineId);
      for (const role of preset!.sceneRoles) {
        const templateId = getPresetTemplateId({
          presetId: "creator-punch",
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
    expect(getPresetSceneComponent("creator-punch")).toBe(CreatorPunchScene);
  });
});

describe("Data Story renderer adapters", () => {
  it("maps every role to a compatible template on both engines", () => {
    const preset = getProductionPreset("data-story");
    expect(preset).toBeDefined();

    for (const engineId of ["hyperframes", "remotion"] as const) {
      const engine = getVideoEngine(engineId);
      for (const role of preset!.sceneRoles) {
        const templateId = getPresetTemplateId({
          presetId: "data-story",
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
    expect(getPresetSceneComponent("data-story")).toBe(DataStoryScene);
  });
});

describe("Developer Demo renderer adapters", () => {
  it("maps every role to a compatible template on both engines", () => {
    const preset = getProductionPreset("developer-demo");
    expect(preset).toBeDefined();
    for (const engineId of ["hyperframes", "remotion"] as const) {
      const engine = getVideoEngine(engineId);
      for (const role of preset!.sceneRoles) {
        const templateId = getPresetTemplateId({
          presetId: "developer-demo",
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
    expect(getPresetSceneComponent("developer-demo")).toBe(DeveloperDemoScene);
  });
});
