import { NextResponse } from "next/server";
import { z } from "zod";

import { getAIProvider, isAIProviderId } from "@/providers/ai/registry";
import { AIError, AI_PROVIDER_IDS } from "@/providers/ai/types";
import { createProjectFromPlan } from "@/library/repositories/projects";
import { resolveSceneBackgrounds } from "@/library/stock-backgrounds";
import { orientationSchema, DEFAULT_ORIENTATION } from "@/lib/orientation";
import { errorResponse } from "@/server/api-helpers";

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
});

/** POST /api/projects/ai - generate a scene plan from a brief and create the project. */
export async function POST(req: Request) {
  try {
    const body = bodySchema.parse(await req.json());
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
    const plan = await provider.generatePlan({
      mode: body.mode,
      brief: body.brief,
      sceneCount: body.sceneCount,
      modelId: body.modelId,
      orientation,
    });

    // Best-effort: turn the director's backgroundQuery hints into real stock
    // backgrounds (no-op when no Unsplash key is configured).
    const backgrounds = await resolveSceneBackgrounds(plan.scenes, orientation);

    const created = await createProjectFromPlan(plan, orientation, backgrounds);
    return NextResponse.json({ ...created, plan }, { status: 201 });
  } catch (e) {
    return errorResponse(e);
  }
}
