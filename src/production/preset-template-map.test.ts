import { describe, expect, it } from "vitest";

import { getVideoEngine } from "@/engines/registry";
import { getProductionPreset } from "@/production/presets";
import { getPresetTemplateId } from "@/production/preset-template-map";

describe("Product Launch renderer adapters", () => {
  it("maps every role to a compatible template on HyperFrames", () => {
    const preset = getProductionPreset("product-launch");
    expect(preset).toBeDefined();

    for (const engineId of ["hyperframes"] as const) {
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

});

describe("Editorial Explainer renderer adapters", () => {
  it("maps every role to a compatible template on HyperFrames", () => {
    const preset = getProductionPreset("editorial-explainer");
    expect(preset).toBeDefined();

    for (const engineId of ["hyperframes"] as const) {
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

});

describe("Creator Punch renderer adapters", () => {
  it("maps every role to a compatible template on HyperFrames", () => {
    const preset = getProductionPreset("creator-punch");
    expect(preset).toBeDefined();

    for (const engineId of ["hyperframes"] as const) {
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

});

describe("Data Story renderer adapters", () => {
  it("maps every role to a compatible template on HyperFrames", () => {
    const preset = getProductionPreset("data-story");
    expect(preset).toBeDefined();

    for (const engineId of ["hyperframes"] as const) {
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

});

describe("Developer Demo renderer adapters", () => {
  it("maps every role to a compatible template on HyperFrames", () => {
    const preset = getProductionPreset("developer-demo");
    expect(preset).toBeDefined();
    for (const engineId of ["hyperframes"] as const) {
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

});

describe("Cinematic Brand renderer adapters", () => {
  it("maps every role to a compatible template on HyperFrames", () => {
    const preset = getProductionPreset("cinematic-brand");
    expect(preset).toBeDefined();
    for (const engineId of ["hyperframes"] as const) {
      const engine = getVideoEngine(engineId);
      for (const role of preset!.sceneRoles) {
        const templateId = getPresetTemplateId({
          presetId: "cinematic-brand",
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

});
