import { NextResponse } from "next/server";

import { defaultTemplateIdForEngine } from "@/engines/registry";
import type { VideoEngineId } from "@/engines/types";
import { orientationFromDims } from "@/lib/orientation";
import { aiEnhanceRequestSchema } from "@/library/ai-enhance-input";
import { generateSceneAppend } from "@/library/generate-scene-append";
import { prepareSceneAppendScope } from "@/library/scene-append-scope";
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
import { reportStockMediaSelectionUsage } from "@/library/stock-media-usage";
import { getPresetTemplateId } from "@/production/preset-template-map";
import type { ProductionPresetId } from "@/production/presets";
import type { ProductionSceneRole } from "@/production/roles";
import { getAIProvider, isAIProviderId } from "@/providers/ai/registry";
import { AIError, type AIScene } from "@/providers/ai/types";
import { errorResponse, readRequestJson } from "@/server/api-helpers";
import { authorizeProviderRequest } from "@/server/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

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
    const parsed = aiEnhanceRequestSchema.safeParse(await readRequestJson(req));
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
    if (body.chapterTitle !== undefined && body.mode !== "append")
      return NextResponse.json(
        { error: "A new chapter title is only supported for append" },
        { status: 400 },
      );
    if (body.mode === "append" && body.sceneIds !== undefined)
      return NextResponse.json(
        { error: "Scene selection is only supported for rewrites" },
        { status: 400 },
      );
    await authorizeProviderRequest(req, [body.providerId]);

    if (!isAIProviderId(body.providerId)) {
      throw new AIError(`Unknown AI provider "${body.providerId}"`, 404);
    }

    const expectedStoryboardState =
      body.mode !== "hook_variants"
        ? await captureSceneRewriteState(scriptId)
        : undefined;
    const script = await getScript(scriptId);
    if (!script) {
      return NextResponse.json({ error: "Script not found" }, { status: 404 });
    }

    if (expectedStoryboardState)
      assertSceneRewriteState(
        expectedStoryboardState,
        await captureSceneRewriteState(scriptId),
      );
    const rewriteScope =
      body.mode === "rewrite"
        ? prepareRegenerationScope(script, body)
        : undefined;

    if (body.mode === "append") prepareSceneAppendScope(script, body);

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
        expectedState: expectedStoryboardState!,
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

    const { mediaDecisions } = await generateSceneAppend({
      script,
      expectedState: expectedStoryboardState!,
      body,
      signal: req.signal,
    });

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
