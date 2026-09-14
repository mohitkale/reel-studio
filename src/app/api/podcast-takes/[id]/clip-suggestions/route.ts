import { NextResponse } from "next/server";
import { z } from "zod";

import {
  deterministicPodcastClipSuggestions,
  groundPodcastClipSuggestions,
} from "@/providers/ai/podcast-clip-suggestions";
import { getAIProvider } from "@/providers/ai/registry";
import { AIError, AI_PROVIDER_IDS } from "@/providers/ai/types";
import { getPodcast, getPodcastTake } from "@/library/repositories/podcasts";
import { authorize, authorizeProviderRequest } from "@/server/auth";
import { errorResponse } from "@/server/api-helpers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

const bodySchema = z
  .object({
    providerId: z.enum(AI_PROVIDER_IDS),
    modelId: z.string().trim().min(1).max(160).optional(),
  })
  .strict();

export async function GET(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    authorize(req);
    const { id } = await ctx.params;
    const take = await getPodcastTake(id);
    if (!take) {
      return NextResponse.json({ error: "Take not found" }, { status: 404 });
    }
    return NextResponse.json({
      suggestions: deterministicPodcastClipSuggestions(take),
    });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    const body = bodySchema.parse(await req.json());
    await authorizeProviderRequest(req, [body.providerId]);
    const { id } = await ctx.params;
    const take = await getPodcastTake(id);
    if (!take) {
      return NextResponse.json({ error: "Take not found" }, { status: 404 });
    }
    const podcast = await getPodcast(take.podcastId);
    if (!podcast) {
      return NextResponse.json({ error: "Podcast not found" }, { status: 404 });
    }
    const provider = getAIProvider(body.providerId);
    if (!provider.isConfigured()) {
      throw new AIError(
        `${provider.label} has no API key. Add one in Settings.`,
        400,
        body.providerId,
      );
    }
    const candidates = await provider.generatePodcastClipSuggestions({
      title: podcast.title,
      fps: take.fps,
      timeline: take.timeline,
      modelId: body.modelId,
    });
    try {
      return NextResponse.json({
        suggestions: groundPodcastClipSuggestions(take, candidates),
      });
    } catch (error) {
      throw new AIError(
        error instanceof Error ? error.message : "Invalid clip suggestions",
        502,
        body.providerId,
      );
    }
  } catch (error) {
    return errorResponse(error);
  }
}
