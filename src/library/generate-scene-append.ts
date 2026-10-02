import { z } from "zod";
import type { MotionDirection } from "@/production/motion";
import { planMotionSequence } from "@/production/motion-plan";

import type { SceneBackground, SceneChartData } from "@/video/types";
import { orientationFromDims } from "@/lib/orientation";
import type { aiEnhanceRequestSchema } from "@/library/ai-enhance-input";
import type { ScriptDTO } from "@/lib/dto";
import { prepareSceneAppendScope } from "@/library/scene-append-scope";
import { commitSceneAppend } from "@/library/scene-append-service";
import { enrichScenePlan } from "@/library/enrich-scene-plan";
import { resolveAutomaticSceneMediaBatch } from "@/library/automatic-stock-media";
import { reportStockMediaSelectionUsage } from "@/library/stock-media-usage";
import { applyPresetToAIPlan } from "@/production/ai-preset-plan";
import type { ProductionSceneRole } from "@/production/roles";
import { getAIProvider } from "@/providers/ai/registry";
import { AIError, scenePlanSchema } from "@/providers/ai/types";
import { mediaPreferenceSchema } from "@/lib/media-preference";

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

/** Shared bounded append for Add scenes and reviewed topic chapters. */
export async function generateSceneAppend(input: {
  script: ScriptDTO;
  expectedState: string;
  body: z.output<typeof aiEnhanceRequestSchema>;
  signal?: AbortSignal;
  draftChapterId?: string;
}) {
  const { script, expectedState, body, signal, draftChapterId } = input;
  const scriptId = script.id;
  const provider = getAIProvider(body.providerId);
  const videoEngine = script.videoEngine;
  const orientation = orientationFromDims(script.width, script.height);
  const context =
    script.scenes.length || !draftChapterId
      ? prepareSceneAppendScope(script, body).context
      : "";
  const raw = await provider.generatePlan({
    mode: "append",
    brief: body.brief,
    sceneCount: body.sceneCount,
    existingContext: context,
    chapterTitle: body.chapterTitle,
    existingSceneCount: script.scenes.length,
    modelId: body.modelId,
    orientation,
    scriptStyle: body.scriptStyle,
    videoEngine,
    productionPresetId: script.productionPreset?.id,
    mediaPreference: body.mediaPreference,
    signal: signal,
  });
  const enriched = scenePlanSchema.parse({
    ...raw,
    scenes: enrichScenePlan(raw.scenes, videoEngine),
  });
  if (
    !enriched.scenes.length ||
    (body.sceneCount === undefined && enriched.scenes.length > 5) ||
    (body.sceneCount !== undefined &&
      enriched.scenes.length !== body.sceneCount)
  )
    throw new AIError(
      "The AI provider did not return the requested scene count",
      502,
    );
  if (script.scenes.length || !draftChapterId)
    prepareSceneAppendScope(script, {
      ...body,
      sceneCount: enriched.scenes.length,
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
  const motions = script.productionPreset
    ? planMotionSequence(
        resolved.plan.scenes.map((scene, index) => ({
          role: roles[index],
          chapterIndex:
            body.chapterTitle !== undefined
              ? (script.chapterPlan?.chapters.length ??
                (draftChapterId && !script.scenes.length ? 0 : undefined))
              : script.chapterPlan
                ? script.chapterPlan.chapters.length - 1
                : undefined,
          chapterStart: body.chapterTitle !== undefined && index === 0,
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
  const appendedIds = await commitSceneAppend({
    scriptId,
    expectedState: expectedState,
    chapterTitle: body.chapterTitle,
    draftChapterId,
    mediaDecisions,
    signal: signal,
    scenes: resolved.plan.scenes.map((scene, index) => {
      const motion = motions[index];
      return {
        templateId: scene.templateId,
        text: scene.text,
        spokenText: scene.spokenText ?? null,
        emphasis: scene.emphasis.length ? JSON.stringify(scene.emphasis) : null,
        visual: scene.visual ?? null,
        layoutJson: layoutJsonFor(
          backgrounds[index],
          {
            ...scene,
            mediaPreference:
              mediaDecisions[index]?.snapshot?.providerSnapshot.kind ??
              body.mediaPreference,
          },
          roles[index],
          motion,
        ),
      };
    }),
  });

  for (const [index, id] of appendedIds.entries()) {
    if (mediaDecisions[index]?.snapshot?.usageEvent.state === "pending")
      await reportStockMediaSelectionUsage(id).catch(() => undefined);
  }

  return { appendedIds, mediaDecisions };
}
