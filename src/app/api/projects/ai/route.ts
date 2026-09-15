import { NextResponse } from "next/server";
import { z } from "zod";

import { getAIProvider, isAIProviderId } from "@/providers/ai/registry";
import { AIError, AI_PROVIDER_IDS, SCRIPT_STYLES } from "@/providers/ai/types";
import { createProjectFromPlan } from "@/library/repositories/projects";
import {
  enrichScenePlan,
  resolvePlanVisualStyle,
} from "@/library/enrich-scene-plan";
import { resolveAutomaticSceneMediaBatch } from "@/library/automatic-stock-media";
import { reportStockMediaSelectionUsage } from "@/library/stock-media-usage";
import { getScript } from "@/library/repositories/scripts";
import { autoAttachBundledMusic } from "@/library/soundtrack-service";
import { ensureSfxCues } from "@/library/sfx-service";
import { orientationSchema, DEFAULT_ORIENTATION } from "@/lib/orientation";
import { VIDEO_ENGINE_IDS, DEFAULT_VIDEO_ENGINE } from "@/engines/types";
import { authorizeProviderRequest } from "@/server/auth";
import { errorResponse } from "@/server/api-helpers";
import {
  getProductionPreset,
  productionPresetIdSchema,
} from "@/production/presets";
import { applyPresetToAIPlan } from "@/production/ai-preset-plan";
import { mediaPreferenceSchema } from "@/lib/media-preference";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const bodySchema = z.object({
  providerId: z.enum(AI_PROVIDER_IDS),
  modelId: z.string().optional(),
  mode: z.enum(["idea", "story"]),
  brief: z.string().trim().min(3).max(8000),
  sceneCount: z.number().int().min(3).max(20).optional(),
  orientation: orientationSchema.optional(),
  scriptStyle: z.enum(SCRIPT_STYLES).optional(),
  videoEngine: z.enum(VIDEO_ENGINE_IDS).optional(),
  /** "auto" lets the AI choose; otherwise lock Style for the whole reel. */
  styleId: z
    .enum(["auto", "bold-hook", "clean-story", "teach-me", "soft-brand"])
    .optional(),
  /** "auto" lets the AI choose; otherwise lock Energy. */
  energy: z.enum(["auto", "calm", "normal", "high"]).optional(),
  productionPresetId: productionPresetIdSchema.default("product-launch"),
  mediaPreference: mediaPreferenceSchema.default("auto"),
});

/** POST /api/projects/ai - generate a scene plan from a brief and create the project. */
export async function POST(req: Request) {
  try {
    const body = bodySchema.parse(await req.json());
    await authorizeProviderRequest(req, [body.providerId]);
    if (!isAIProviderId(body.providerId)) {
      throw new AIError(`Unknown AI provider "${body.providerId}"`, 404);
    }

    const provider = getAIProvider(body.providerId);
    if (!provider.isConfigured()) {
      throw new AIError(
        `${provider.label} has no API key. Add one in Settings.`,
        400,
        body.providerId,
      );
    }

    const orientation = body.orientation ?? DEFAULT_ORIENTATION;
    const videoEngine = body.videoEngine ?? DEFAULT_VIDEO_ENGINE;
    const preset = getProductionPreset(body.productionPresetId);
    if (!preset) throw new AIError("Unknown production preset", 400);
    const styleLock =
      body.styleId && body.styleId !== "auto"
        ? body.styleId
        : preset.defaults.styleId;
    const energyLock =
      body.energy && body.energy !== "auto"
        ? body.energy
        : preset.defaults.energy;
    const raw = await provider.generatePlan({
      mode: body.mode,
      brief: body.brief,
      sceneCount: body.sceneCount,
      modelId: body.modelId,
      orientation,
      scriptStyle: body.scriptStyle,
      videoEngine,
      styleId: styleLock,
      energy: energyLock,
      productionPresetId: body.productionPresetId,
      mediaPreference: body.mediaPreference,
    });
    const enriched = {
      ...raw,
      scenes: enrichScenePlan(raw.scenes, videoEngine),
    };
    const visualStyle = resolvePlanVisualStyle(enriched, {
      styleId: styleLock,
      energy: energyLock,
    });

    const mediaDecisions = await resolveAutomaticSceneMediaBatch(
      enriched.scenes,
      orientation,
      enriched.scenes.map(() => body.mediaPreference),
    );
    const backgrounds = mediaDecisions.map((decision) => decision.background);
    const { plan, roles } = applyPresetToAIPlan(
      enriched,
      body.productionPresetId,
      videoEngine,
      { hasVisualAsset: backgrounds.some(Boolean) },
    );

    const created = await createProjectFromPlan(
      plan,
      orientation,
      backgrounds,
      videoEngine,
      visualStyle,
      {
        preset: {
          id: body.productionPresetId,
          version: preset.version,
        },
        roles,
        mediaPreferences: enriched.scenes.map(() => body.mediaPreference),
        stockSelections: mediaDecisions.map((decision) => decision.snapshot),
        outputType: "video",
        creationSource: { kind: "text" },
      },
    );
    const persisted = await getScript(created.scriptId);
    for (const scene of persisted?.scenes ?? []) {
      await reportStockMediaSelectionUsage(scene.id).catch(() => undefined);
    }
    // One-click soundtrack: attach bundled BGM from scene mood/musicMood.
    await autoAttachBundledMusic(created.scriptId);
    await ensureSfxCues(created.scriptId);
    return NextResponse.json(
      {
        ...created,
        plan,
        visualStyle,
        mediaDecisions: mediaDecisions.map(
          ({ state, kind, providerId, attemptedProviders, message }) => ({
            state,
            kind,
            providerId,
            attemptedProviders,
            message,
          }),
        ),
      },
      { status: 201 },
    );
  } catch (e) {
    return errorResponse(e);
  }
}
