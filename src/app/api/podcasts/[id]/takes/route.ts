import {
  submitEditorVoice,
  podcastVoiceSignature,
} from "@/library/editor-jobs";
import { NextResponse } from "next/server";

import { getPodcast, listPodcastTakes } from "@/library/repositories/podcasts";
import { authorizeProviderRequest, authorizeRead } from "@/server/auth";
import {
  errorResponse,
  parseClientInput,
  readRequestJson,
} from "@/server/api-helpers";
import { z } from "zod";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const generatePodcastTakeSchema = z.object({
  regenerateTurnIds: z.array(z.string().min(1)).max(120).optional(),
});

export async function GET(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    authorizeRead(req);
    const { id } = await ctx.params;
    return NextResponse.json({ takes: await listPodcastTakes(id) });
  } catch (e) {
    return errorResponse(e);
  }
}

/**
 * Kick off podcast audio generation as a background job (202 + jobId).
 * Each character voice is synthesized per turn in parallel, then stitched in order.
 */
export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await ctx.params;
    const body = parseClientInput(
      generatePodcastTakeSchema,
      await readRequestJson(req, { allowEmpty: true }),
    );
    const podcast = await getPodcast(id);
    await authorizeProviderRequest(
      req,
      podcast?.characters.map((character) => character.providerId) ?? [],
    );
    const jobId = await submitEditorVoice({
      operation: "podcast",
      resourceId: id,
      ...body,
      podcastVoiceSignature: podcast
        ? podcastVoiceSignature(podcast)
        : undefined,
    });

    return NextResponse.json({ jobId }, { status: 202 });
  } catch (e) {
    return errorResponse(e);
  }
}
