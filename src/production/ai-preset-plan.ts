import { defaultTemplateIdForEngine } from "@/engines/registry";
import type { VideoEngineId } from "@/engines/types";
import { getPresetTemplateId } from "@/production/preset-template-map";
import {
  getProductionPreset,
  type ProductionPresetId,
} from "@/production/presets";
import type { ProductionSceneRole } from "@/production/roles";
import { scenePlanSchema, type ScenePlan } from "@/providers/ai/types";

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
  return [
    ...new Set(
      preset.sceneRoles.flatMap((role) => {
        const templateId = getPresetTemplateId({ presetId, engineId, role });
        return templateId ? [templateId] : [];
      }),
    ),
  ];
}

export function applyPresetToAIPlan(
  plan: ScenePlan,
  presetId: ProductionPresetId,
  engineId: VideoEngineId,
  options: { hasVisualAsset?: boolean; continuation?: boolean } = {},
): { plan: ScenePlan; roles: ProductionSceneRole[] } {
  const roles = resolvePresetRoles(presetId, plan.scenes.length, options);
  return {
    roles,
    plan: scenePlanSchema.parse({
      ...plan,
      scenes: plan.scenes.map((scene, index) => ({
        ...scene,
        templateId:
          getPresetTemplateId({ presetId, engineId, role: roles[index]! }) ??
          defaultTemplateIdForEngine(engineId),
      })),
    }),
  };
}
