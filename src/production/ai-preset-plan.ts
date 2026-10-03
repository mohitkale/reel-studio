import { defaultTemplateIdForEngine } from "@/engines/registry";
import type { VideoEngineId } from "@/engines/types";
import { getPresetTemplateId } from "@/production/preset-template-map";
import {
  getProductionPreset,
  type ProductionPresetId,
} from "@/production/presets";
import type { ProductionSceneRole } from "@/production/roles";
import { scenePlanSchema, type ScenePlan } from "@/providers/ai/types";
import { capabilityIdForTemplateId } from "@/engines/capabilities";
import { directScene, groundSceneData } from "@/production/director";

const MEDIA_ROLES = new Set<ProductionSceneRole>([
  "screenshot-demo",
  "browser",
  "hero",
]);

export function resolvePresetRoles(
  presetId: ProductionPresetId,
  count: number,
  options: { hasVisualAsset?: boolean; continuation?: boolean } = {},
): ProductionSceneRole[] {
  const preset = getProductionPreset(presetId);
  if (!preset) throw new Error(`Unknown production preset: ${presetId}`);
  let candidates = preset.sceneRoles.filter(
    (role) => options.hasVisualAsset || !MEDIA_ROLES.has(role),
  );
  if (presetId === "data-story") candidates = ["takeaway"];
  if (!candidates.length) candidates = [...preset.sceneRoles];

  if (options.continuation) {
    if (candidates.length > 2) candidates = candidates.slice(1, -1);
    return Array.from(
      { length: count },
      (_, index) => candidates[index % candidates.length]!,
    );
  }

  if (candidates.length === 1) {
    return Array.from({ length: count }, () => candidates[0]!);
  }
  const middle = candidates.slice(1, -1);
  return Array.from({ length: count }, (_, index) =>
    index === 0
      ? candidates[0]!
      : index === count - 1
        ? candidates[candidates.length - 1]!
        : (middle[(index - 1) % middle.length] ?? candidates[0]!),
  );
}

export function allowedPresetTemplateIds(
  presetId: ProductionPresetId,
  engineId: VideoEngineId,
): string[] {
  const preset = getProductionPreset(presetId);
  if (!preset) return [defaultTemplateIdForEngine(engineId)];
  const ids = [
    ...new Set(
      preset.sceneRoles.flatMap((role) => {
        const templateId = getPresetTemplateId({ presetId, engineId, role });
        return templateId ? [templateId] : [];
      }),
    ),
  ];
  if (ids.includes("hf-broll")) {
    ids.push("hf-statement");
  }
  return ids;
}

export function allowedPresetCapabilityIds(
  presetId: ProductionPresetId,
  engineId: VideoEngineId,
): string[] {
  return allowedPresetTemplateIds(presetId, engineId).flatMap((templateId) => {
    const capabilityId = capabilityIdForTemplateId(engineId, templateId);
    return capabilityId ? [capabilityId] : [];
  });
}

export function applyPresetToAIPlan(
  plan: ScenePlan,
  presetId: ProductionPresetId,
  engineId: VideoEngineId,
  options: {
    hasVisualAsset?: boolean;
    sceneHasVisual?: boolean[];
    continuation?: boolean;
    /** Actual user source, used to admit numeric displays from AI output. */
    source?: string;
  } = {},
): { plan: ScenePlan; roles: ProductionSceneRole[] } {
  const roles = resolvePresetRoles(presetId, plan.scenes.length, options);
  return {
    roles,
    plan: scenePlanSchema.parse({
      ...plan,
      scenes: plan.scenes.map((scene, index) => {
        const directed = directScene(
          scene,
          roles[index]!,
          options.sceneHasVisual?.[index] ?? options.hasVisualAsset,
        );
        let rejectedData = false;
        if (options.source !== undefined) {
          const grounded = groundSceneData(directed.scene, options.source);
          if (
            (directed.scene.chart && !grounded.chart) ||
            (directed.scene.visual &&
              !grounded.visual &&
              /\d/.test(directed.scene.visual))
          ) {
            rejectedData = true;
            grounded.templateId = "hf-statement";
            directed.role = "explanation";
            grounded.direction = {
              version: 1,
              role: "explanation",
              composition: "authored",
            };
          }
          directed.scene = grounded;
        }
        roles[index] = directed.role;
        const mapped =
          getPresetTemplateId({ presetId, engineId, role: roles[index]! }) ??
          defaultTemplateIdForEngine(engineId);
        return {
          ...directed.scene,
          templateId: rejectedData
            ? "hf-statement"
            : directed.scene.templateId !== scene.templateId ||
                directed.scene.direction?.composition === "layered-title" ||
                ["chart", "metric", "quote", "diagram"].includes(
                  directed.role,
                ) ||
                (directed.role === "comparison" &&
                  Boolean(directed.scene.items?.length))
              ? directed.scene.templateId
              : mapped === "hf-broll" &&
                  options.sceneHasVisual?.[index] === false
                ? "hf-statement"
                : mapped,
        };
      }),
    }),
  };
}
