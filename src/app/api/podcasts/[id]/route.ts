import { NextResponse } from "next/server";
import { z } from "zod";

import {
  deletePodcast,
  getPodcast,
  updatePodcastMeta,
} from "@/library/repositories/podcasts";
import { podcastLengthSchema } from "@/library/podcast-schemas";
import { authorize } from "@/server/auth";
import { ProviderError } from "@/providers/voice/types";
import { errorResponse } from "@/server/api-helpers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const patchSchema = z.object({
  title: z.string().trim().min(1).max(120).optional(),
  description: z.string().trim().max(2000).optional(),
  length: podcastLengthSchema.optional(),
});

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await ctx.params;
    const podcast = await getPodcast(id);
    if (!podcast) {
      return NextResponse.json({ error: "Podcast not found" }, { status: 404 });
    }
    return NextResponse.json({ podcast });
  } catch (e) {
    return errorResponse(e);
  }
}

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    authorize(req);
    const { id } = await ctx.params;
    const body = patchSchema.parse(await req.json());
    const podcast = await updatePodcastMeta(id, body);
    return NextResponse.json({ podcast });
  } catch (e) {
    return errorResponse(e);
  }
}

export async function DELETE(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    if (authorize(req) === "mcp") {
      throw new ProviderError("Deletion is not available via MCP", 403);
    }
    const { id } = await ctx.params;
    await deletePodcast(id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return errorResponse(e);
  }
}
