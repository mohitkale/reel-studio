import { NextResponse } from "next/server";
import { z } from "zod";

import { getAIProvider, isAIProviderId } from "@/providers/ai/registry";
import { AIError, AI_PROVIDER_IDS } from "@/providers/ai/types";
import {
  getPodcast,
  replaceTurnsFromPlan,
  updatePodcastMeta,
} from "@/library/repositories/podcasts";
import { podcastLengthSchema } from "@/library/podcast-schemas";
import { podcastPresetIdSchema } from "@/library/podcast-presets";
import { authorizeProviderRequest } from "@/server/auth";
import { errorResponse } from "@/server/api-helpers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

const bodySchema = z.object({
  providerId: z.enum(AI_PROVIDER_IDS),
  modelId: z.string().optional(),
  brief: z.string().trim().min(3).max(8000),
  /** When set, temporarily overrides podcast.length for this generation. */
  length: podcastLengthSchema.optional(),
  presetId: podcastPresetIdSchema.optional(),
  updateMeta: z.boolean().optional(),
});

/** POST /api/podcasts/:id/ai — generate a humanised multi-speaker script. */
export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await ctx.params;
    const body = bodySchema.parse(await req.json());
    await authorizeProviderRequest(req, [body.providerId]);
    if (!isAIProviderId(body.providerId)) {
      throw new AIError(`Unknown AI provider "${body.providerId}"`, 404);
    }

    const podcast = await getPodcast(id);
    if (!podcast) {
      return NextResponse.json({ error: "Podcast not found" }, { status: 404 });
    }
    if (podcast.characters.length < 1) {
      throw new AIError(
        "Configure at least 1 character before generating",
        400,
      );
    }
    const requestedPreset = body.presetId ?? podcast.presetId;
    if (
      requestedPreset === "solo-narration" &&
      podcast.characters.length !== 1
    ) {
      throw new AIError(
        "Solo narration needs exactly one configured character",
        400,
      );
    }
    if (requestedPreset !== "solo-narration" && podcast.characters.length < 2) {
      throw new AIError(
        "Discussion and interview formats need at least 2 characters",
        400,
      );
    }

    const provider = getAIProvider(body.providerId);
    if (!provider.isConfigured()) {
      throw new AIError(
        `${provider.label} has no API key. Add one in Settings.`,
        400,
        body.providerId,
      );
    }

    const length = body.length ?? podcast.length;
    const plan = await provider.generatePodcastPlan({
      brief: body.brief,
      length,
      modelId: body.modelId,
      characters: podcast.characters.map((c) => ({
        key: c.key,
        name: c.name,
        gender: c.gender,
        definition: c.definition,
      })),
      presetId: requestedPreset,
    });

    let updated = await replaceTurnsFromPlan(id, plan, {
      updateMeta: body.updateMeta ?? true,
    });
    if (body.presetId && body.updateMeta !== false) {
      updated = await updatePodcastMeta(id, { presetId: body.presetId });
    }
    return NextResponse.json({ podcast: updated, plan });
  } catch (e) {
    return errorResponse(e);
  }
}
