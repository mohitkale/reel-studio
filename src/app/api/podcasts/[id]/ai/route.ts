import { NextResponse } from "next/server";
import { z } from "zod";

import { getAIProvider, isAIProviderId } from "@/providers/ai/registry";
import { AIError, AI_PROVIDER_IDS } from "@/providers/ai/types";
import {
  getPodcast,
  replaceTurnsFromPlan,
} from "@/library/repositories/podcasts";
import { podcastLengthSchema } from "@/library/podcast-schemas";
import { authorize } from "@/server/auth";
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
  updateMeta: z.boolean().optional(),
});

/** POST /api/podcasts/:id/ai — generate a humanised multi-speaker script. */
export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    authorize(req);
    const { id } = await ctx.params;
    const body = bodySchema.parse(await req.json());
    if (!isAIProviderId(body.providerId)) {
      throw new AIError(`Unknown AI provider "${body.providerId}"`, 404);
    }

    const podcast = await getPodcast(id);
    if (!podcast) {
      return NextResponse.json({ error: "Podcast not found" }, { status: 404 });
    }
    if (podcast.characters.length < 2) {
      throw new AIError("Configure at least 2 characters before generating", 400);
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
    });

    const updated = await replaceTurnsFromPlan(id, plan, {
      updateMeta: body.updateMeta ?? true,
    });
    return NextResponse.json({ podcast: updated, plan });
  } catch (e) {
    return errorResponse(e);
  }
}
