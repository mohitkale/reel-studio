import { NextResponse } from "next/server";
import { z } from "zod";
import type { MotionDirection } from "@/production/motion";
import { planMotionSequence } from "@/production/motion-plan";

import type { SceneBackground, SceneChartData } from "@/compositions/types";
import { defaultTemplateIdForEngine } from "@/engines/registry";
import type { VideoEngineId } from "@/engines/types";
import { orientationFromDims } from "@/lib/orientation";
import { prisma } from "@/library/db";
import { enrichScenePlan } from "@/library/enrich-scene-plan";
import { getScript } from "@/library/repositories/scripts";
import {
  describeSceneForAI,
  prepareRegenerationScope,
} from "@/library/selective-scene-regeneration";
import {
  captureSceneRewriteState,
  assertSceneRewriteState,
  commitSceneRewrite,
} from "@/library/scene-rewrite-service";
import { resolveAutomaticSceneMediaBatch } from "@/library/automatic-stock-media";
import { applyStockMediaSelection } from "@/library/repositories/stock-media-selections";
import { reportStockMediaSelectionUsage } from "@/library/stock-media-usage";
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
import { mediaPreferenceSchema } from "@/lib/media-preference";

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
  chapterId: z.string().min(1).max(160).optional(),
  scriptStyle: z.enum(SCRIPT_STYLES).optional(),
  mediaPreference: mediaPreferenceSchema.default("auto"),
});

/** Build the Scene.layoutJson payload for a newly appended AI scene. */
function layoutJsonFor(
  background: SceneBackground | undefined,
  scene: {
    mood?: string;
    musicMood?: string;
    items?: string[];
    chart?: SceneChartData;
    mediaPreference?: z.infer<typeof mediaPreferenceSchema>;
  },
  role?: ProductionSceneRole,
  motion?: MotionDirection,
): string | null {
  const config: Record<string, unknown> = {};
  if (background) config.background = background;
  if (scene.mood) config.mood = scene.mood;
  if (scene.musicMood) config.musicMood = scene.musicMood;
  if (scene.items?.length) config.items = scene.items;
  if (scene.chart) config.chart = scene.chart;
  if (scene.mediaPreference) config.mediaPreference = scene.mediaPreference;
  if (role) config.role = role;
  if (motion) config.motion = motion;
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
    const parsed = bodySchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success)
      return NextResponse.json(
        { error: "Invalid AI request", issues: parsed.error.issues },
        { status: 400 },
      );
    const body = parsed.data;
    if (body.chapterId && body.mode !== "rewrite")
      return NextResponse.json(
        { error: "Chapter selection is only supported for rewrites" },
        { status: 400 },
      );
    await authorizeProviderRequest(req, [body.providerId]);

    if (!isAIProviderId(body.providerId)) {
      throw new AIError(`Unknown AI provider "${body.providerId}"`, 404);
    }

    const expectedRewriteState =
      body.mode === "rewrite"
        ? await captureSceneRewriteState(scriptId)
        : undefined;
    const script = await getScript(scriptId);
    if (!script) {
      return NextResponse.json({ error: "Script not found" }, { status: 404 });
    }

    if (expectedRewriteState)
      assertSceneRewriteState(
        expectedRewriteState,
        await captureSceneRewriteState(scriptId),
      );
    const rewriteScope =
      body.mode === "rewrite"
        ? prepareRegenerationScope(script, body)
        : undefined;

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
    const existingContext =
      body.mode === "rewrite"
        ? ""
        : script.scenes.map(describeSceneForAI).join("\n");

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
        signal: req.signal,
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
      const { targets, positions, context } = rewriteScope!;
      const raw = await provider.generatePlan({
        mode: "rewrite",
        brief: body.brief,
        sceneCount: targets.length,
        existingContext: context,
        existingSceneCount: script.scenes.length,
        replacementSceneNumbers: positions,
        modelId: body.modelId,
        orientation,
        scriptStyle: body.scriptStyle,
        videoEngine,
        productionPresetId: script.productionPreset?.id,
        signal: req.signal,
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
      const mediaDecisions = await resolveAutomaticSceneMediaBatch(
        generated,
        orientation,
        targets.map((target) =>
          target.locks?.assets ? "none" : (target.mediaPreference ?? "auto"),
        ),
        targets.map((target) => target.background),
      );
      await commitSceneRewrite({
        scriptId,
        expectedState: expectedRewriteState!,
        targets,
        generated,
        mediaDecisions,
        signal: req.signal,
      });
      for (const [index, target] of targets.entries()) {
        if (mediaDecisions[index]?.snapshot?.usageEvent.state === "pending") {
          await reportStockMediaSelectionUsage(target.id).catch(
            () => undefined,
          );
        }
      }

      const updated = await getScript(scriptId);
      return NextResponse.json({
        script: updated,
        changedSceneIds: targets.map((scene) => scene.id),
        mediaDecisions: mediaDecisions.map(
          ({ state, kind, providerId, attemptedProviders, message }) => ({
            state,
            kind,
            providerId,
            attemptedProviders,
            message,
          }),
        ),
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
      mediaPreference: body.mediaPreference,
      signal: req.signal,
    });
    const enriched = scenePlanSchema.parse({
      ...raw,
      scenes: enrichScenePlan(raw.scenes, videoEngine),
    });
    const mediaDecisions = await resolveAutomaticSceneMediaBatch(
      enriched.scenes,
      orientation,
      enriched.scenes.map(() => body.mediaPreference),
    );
    const backgrounds = mediaDecisions.map((decision) => decision.background);
    const resolved = script.productionPreset
      ? applyPresetToAIPlan(enriched, script.productionPreset.id, videoEngine, {
          continuation: true,
          hasVisualAsset: backgrounds.some(Boolean),
        })
      : { plan: enriched, roles: [] as ProductionSceneRole[] };
    const roles = resolved.roles;
    const startOrder = script.scenes.length;
    const motions = script.productionPreset
      ? planMotionSequence(
          resolved.plan.scenes.map((scene, index) => ({
            role: roles[index],
            text: scene.text,
            chart: scene.chart,
            items: scene.items,
            background: backgrounds[index],
            hasVisualContent: Boolean(scene.visual),
          })),
          script.motionPlan ?? {
            version: "1.0.0",
            seed: script.id,
            ambition: "expressive",
          },
          script.scenes.map((scene) => scene.motion),
        )
      : [];
    await prisma.scene.createMany({
      data: resolved.plan.scenes.map((scene, index) => {
        const motion = motions[index];
        return {
          scriptId,
          order: startOrder + index,
          templateId: scene.templateId,
          text: scene.text,
          spokenText: scene.spokenText ?? null,
          emphasis: scene.emphasis.length
            ? JSON.stringify(scene.emphasis)
            : null,
          visual: scene.visual ?? null,
          layoutJson: layoutJsonFor(
            backgrounds[index],
            { ...scene, mediaPreference: body.mediaPreference },
            roles[index],
            motion,
          ),
        };
      }),
    });

    const appended = await prisma.scene.findMany({
      where: { scriptId, order: { gte: startOrder } },
      orderBy: { order: "asc" },
    });
    for (const [index, row] of appended.entries()) {
      const decision = mediaDecisions[index];
      if (!decision?.snapshot || !decision.background) continue;
      await applyStockMediaSelection(
        row.id,
        decision.snapshot,
        decision.background,
      );
      if (decision.snapshot.usageEvent.state === "pending") {
        await reportStockMediaSelectionUsage(row.id).catch(() => undefined);
      }
    }

    const updated = await getScript(scriptId);
    return NextResponse.json({
      script: updated,
      mediaDecisions: mediaDecisions.map(
        ({ state, kind, providerId, attemptedProviders, message }) => ({
          state,
          kind,
          providerId,
          attemptedProviders,
          message,
        }),
      ),
    });
  } catch (e) {
    return errorResponse(e);
  }
}
