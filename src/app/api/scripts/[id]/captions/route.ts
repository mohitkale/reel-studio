import { z } from "zod";

import { getScript } from "@/library/repositories/scripts";
import { resolveReelTimeline } from "@/lib/reel-timeline";
import { coverFrames } from "@/compositions/types";
import { buildCaptions, type CaptionCue } from "@/lib/captions";
import { errorResponse } from "@/server/api-helpers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const querySchema = z.object({
  format: z.enum(["srt", "vtt"]).default("srt"),
  takeId: z.string().optional(),
});

const CONTENT_TYPE = {
  srt: "application/x-subrip; charset=utf-8",
  vtt: "text/vtt; charset=utf-8",
} as const;

function safeFilename(name: string): string {
  const base = name.trim().replace(/[^a-z0-9._-]+/gi, "-").replace(/^-+|-+$/g, "");
  return base || "captions";
}

/**
 * GET /api/scripts/[id]/captions?format=srt|vtt&takeId=...
 *
 * Generates a subtitle file from the script's timeline. Timestamps include the
 * cover-hold offset so they line up with the rendered MP4. Uses the given take's
 * measured timing when usable, otherwise estimated timing.
 */
export async function GET(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await ctx.params;
    const { searchParams } = new URL(req.url);
    const { format, takeId } = querySchema.parse({
      format: searchParams.get("format") ?? undefined,
      takeId: searchParams.get("takeId") ?? undefined,
    });

    const script = await getScript(id);
    if (!script) {
      return new Response("Script not found", { status: 404 });
    }

    const take =
      (takeId && script.takes.find((t) => t.id === takeId)) ||
      script.takes[0] ||
      null;

    const resolved = resolveReelTimeline(
      script.scenes.map((s) => ({ id: s.id, text: s.text })),
      take ? { timeline: take.timeline, totalFrames: take.totalFrames } : null,
      script.fps,
    );

    const offset = coverFrames(script.fps, Boolean(script.coverUrl));
    const textById = new Map(script.scenes.map((s) => [s.id, s.text]));
    const cues: CaptionCue[] = resolved.timeline.map((beat) => ({
      startFrame: beat.startFrame + offset,
      endFrame: beat.startFrame + beat.durationFrames + offset,
      text: textById.get(beat.sceneId) ?? "",
    }));

    const body = buildCaptions(cues, script.fps, format);
    const filename = `${safeFilename(script.name)}.${format}`;

    return new Response(body, {
      status: 200,
      headers: {
        "content-type": CONTENT_TYPE[format],
        "content-disposition": `attachment; filename="${filename}"`,
        "cache-control": "no-store",
      },
    });
  } catch (e) {
    return errorResponse(e);
  }
}
