import { NextResponse } from "next/server";
import { z } from "zod";

import type { SceneBackground, SceneChartData } from "@/compositions/types";
import { defaultTemplateIdForEngine } from "@/engines/registry";
import type { VideoEngineId } from "@/engines/types";
import { orientationFromDims } from "@/lib/orientation";
import { prisma } from "@/library/db";
import { enrichScenePlan } from "@/library/enrich-scene-plan";
import { getScript } from "@/library/repositories/scripts";
import {
  describeSceneForAI,
  mergeGeneratedScene,
  selectRegenerationTargets,
} from "@/library/selective-scene-regeneration";
import { resolveSceneBackgrounds } from "@/library/stock-backgrounds";
import { applyPresetToAIPlan } from "@/production/ai-preset-plan";
import { getPresetTemplateId } from "@/production/preset-template-map";
import type { ProductionPresetId } from "@/production/presets";
import type { ProductionSceneRole } from "@/production/roles";
import { getAIProvider, isAIProviderId } from "@/providers/ai/registry";
import {
  AIError,
  AI_PROVIDER_IDS,
  SCRIPT_STYLES,
  scenePlanSchema,
  type AIScene,
} from "@/providers/ai/types";
import { errorResponse } from "@/server/api-helpers";
import { authorizeProviderRequest } from "@/server/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const bodySchema = z.object({
  providerId: z.enum(AI_PROVIDER_IDS),
  modelId: z.string().optional(),
  mode: z.enum(["rewrite", "append", "hook_variants"]),
  brief: z.string().trim().min(3).max(4000),
  sceneCount: z.number().int().min(1).max(20).optional(),
  sceneIds: z.array(z.string().min(1)).max(20).optional(),
  scriptStyle: z.enum(SCRIPT_STYLES).optional(),
});

/** Build the Scene.layoutJson payload for a newly appended AI scene. */
function layoutJsonFor(
  background: SceneBackground | undefined,
  scene: {
    mood?: string;
    musicMood?: string;
    items?: string[];
    chart?: SceneChartData;
  },
  role?: ProductionSceneRole,
): string | null {
  const config: Record<string, unknown> = {};
  if (background) config.background = background;
  if (scene.mood) config.mood = scene.mood;
  if (scene.musicMood) config.musicMood = scene.musicMood;
  if (scene.items?.length) config.items = scene.items;
  if (scene.chart) config.chart = scene.chart;
  if (role) config.role = role;
  return Object.keys(config).length ? JSON.stringify(config) : null;
}

function mapTemplateForRole(
  scene: AIScene,
  role: ProductionSceneRole | undefined,
  preset: { id: ProductionPresetId; version: string } | undefined,
  engineId: VideoEngineId,
): AIScene {
  if (!preset || !role) return scene;
  return {
    ...scene,
    templateId: (getPresetTemplateId({
      presetId: preset.id,
      engineId,
      role,
    }) ?? defaultTemplateIdForEngine(engineId)) as AIScene["templateId"],
  };
}

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    const { id: scriptId } = await ctx.params;
    const body = bodySchema.parse(await req.json());
    await authorizeProviderRequest(req, [body.providerId]);

    if (!isAIProviderId(body.providerId)) {
      throw new AIError(`Unknown AI provider "${body.providerId}"`, 404);
    }

    const script = await getScript(scriptId);
    if (!script) {
      return NextResponse.json({ error: "Script not found" }, { status: 404 });
    }

    const provider = getAIProvider(body.providerId);
    if (!provider.isConfigured()) {
      throw new AIError(
        `${provider.label} has no API key. Add one in Settings.`,
        400,
        body.providerId,
      );
    }

    if (body.sceneIds) {
      const scriptIds = new Set(script.scenes.map((scene) => scene.id));
      const unknown = body.sceneIds.filter((id) => !scriptIds.has(id));
      if (unknown.length) {
        throw new AIError("One or more selected scenes no longer exist", 400);
      }
    }

    const orientation = orientationFromDims(script.width, script.height);
    const videoEngine = script.videoEngine;
    const existingContext = script.scenes.map(describeSceneForAI).join("\n");

    if (body.mode === "hook_variants") {
      const opening = script.scenes[0];
      if (!opening)
        throw new AIError("Add a scene before generating hooks", 400);
      const raw = await provider.generatePlan({
        mode: "hook_variants",
        brief: body.brief,
        sceneCount: 3,
        existingContext: describeSceneForAI(opening, 0),
        existingSceneCount: script.scenes.length,
        modelId: body.modelId,
        orientation,
        scriptStyle: body.scriptStyle,
        videoEngine,
        productionPresetId: script.productionPreset?.id,
      });
      const alternatives = enrichScenePlan(raw.scenes, videoEngine)
        .slice(0, 3)
        .map((scene) =>
          mapTemplateForRole(
            scene,
            opening.role,
            script.productionPreset,
            videoEngine,
          ),
        );
      if (alternatives.length !== 3) {
        throw new AIError(
          "The AI provider did not return three hook options",
          502,
        );
      }
      return NextResponse.json({ script, alternatives });
    }

    if (body.mode === "rewrite") {
      const targets = selectRegenerationTargets(script.scenes, body.sceneIds);
      if (!targets.length) {
        throw new AIError(
          "No unlocked scenes are selected. Unlock a scene or choose another one.",
          400,
        );
      }
      const positions = targets.map(
        (target) =>
          script.scenes.findIndex((scene) => scene.id === target.id) + 1,
      );
      const raw = await provider.generatePlan({
        mode: "rewrite",
        brief: body.brief,
        sceneCount: targets.length,
        existingContext,
        existingSceneCount: script.scenes.length,
        replacementSceneNumbers: positions,
        modelId: body.modelId,
        orientation,
        scriptStyle: body.scriptStyle,
        videoEngine,
        productionPresetId: script.productionPreset?.id,
      });
      if (raw.scenes.length !== targets.length) {
        throw new AIError(
          `The AI provider returned ${raw.scenes.length} scenes for ${targets.length} selected scenes`,
          502,
        );
      }
      const generated = enrichScenePlan(raw.scenes, videoEngine).map(
        (scene, index) =>
          mapTemplateForRole(
            scene,
            targets[index]?.role,
            script.productionPreset,
            videoEngine,
          ),
      );
      const backgrounds = await resolveSceneBackgrounds(generated, orientation);

      await prisma.$transaction(
        targets.map((target, index) =>
          prisma.scene.update({
            where: { id: target.id },
            data: mergeGeneratedScene(
              target,
              generated[index]!,
              backgrounds[index],
            ),
          }),
        ),
      );

      const updated = await getScript(scriptId);
      return NextResponse.json({
        script: updated,
        changedSceneIds: targets.map((scene) => scene.id),
      });
    }

    const raw = await provider.generatePlan({
      mode: "append",
      brief: body.brief,
      sceneCount: body.sceneCount,
      existingContext,
      existingSceneCount: script.scenes.length,
      modelId: body.modelId,
      orientation,
      scriptStyle: body.scriptStyle,
      videoEngine,
      productionPresetId: script.productionPreset?.id,
    });
    const enriched = scenePlanSchema.parse({
      ...raw,
      scenes: enrichScenePlan(raw.scenes, videoEngine),
    });
    const backgrounds = await resolveSceneBackgrounds(
      enriched.scenes,
      orientation,
    );
    const resolved = script.productionPreset
      ? applyPresetToAIPlan(enriched, script.productionPreset.id, videoEngine, {
          continuation: true,
          hasVisualAsset: backgrounds.some(Boolean),
        })
      : { plan: enriched, roles: [] as ProductionSceneRole[] };
    const roles = resolved.roles;
    const startOrder = script.scenes.length;
    await prisma.scene.createMany({
      data: resolved.plan.scenes.map((scene, index) => ({
        scriptId,
        order: startOrder + index,
        templateId: scene.templateId,
        text: scene.text,
        spokenText: scene.spokenText ?? null,
        emphasis: scene.emphasis.length ? JSON.stringify(scene.emphasis) : null,
        visual: scene.visual ?? null,
        layoutJson: layoutJsonFor(backgrounds[index], scene, roles[index]),
      })),
    });

    const updated = await getScript(scriptId);
    return NextResponse.json({ script: updated });
  } catch (e) {
    return errorResponse(e);
  }
}
