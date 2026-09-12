import { NextResponse } from "next/server";
import { z } from "zod";

import {
  podcastChaptersJson,
  podcastTranscriptText,
} from "@/library/podcast-transcript";
import { getPodcast, getPodcastTake } from "@/library/repositories/podcasts";
import { errorResponse } from "@/server/api-helpers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const formatSchema = z.enum(["transcript", "chapters"]);

function safeName(name: string): string {
  return name.replace(/[^a-z0-9_-]+/gi, "-").replace(/^-|-$/g, "") || "podcast";
}

export async function GET(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await ctx.params;
    const format = formatSchema.parse(
      new URL(req.url).searchParams.get("format") ?? "transcript",
    );
    const take = await getPodcastTake(id);
    if (!take)
      return NextResponse.json({ error: "Take not found" }, { status: 404 });
    const podcast = await getPodcast(take.podcastId);
    if (!podcast)
      return NextResponse.json({ error: "Podcast not found" }, { status: 404 });
    const body =
      format === "chapters"
        ? podcastChaptersJson(take)
        : podcastTranscriptText(podcast, take);
    const ext = format === "chapters" ? "json" : "txt";
    return new NextResponse(body, {
      headers: {
        "Content-Type":
          format === "chapters"
            ? "application/json; charset=utf-8"
            : "text/plain; charset=utf-8",
        "Content-Disposition": `attachment; filename="${safeName(podcast.title)}-${format}.${ext}"`,
      },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
