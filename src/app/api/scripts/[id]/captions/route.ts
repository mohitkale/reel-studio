import { z } from "zod";

import { coverFrames } from "@/compositions/types";
import { buildCaptions, parseCaptions, type CaptionCue } from "@/lib/captions";
import { resolveReelTimeline } from "@/lib/reel-timeline";
import { resolveSpokenText } from "@/lib/spoken-text";
import {
  getCaptionAudioSource,
  replaceCaptionTrack,
  setCaptionTrackEnabled,
} from "@/library/repositories/captions";
import { getScript } from "@/library/repositories/scripts";
import { getAssetStore } from "@/library/storage";
import { transcribeWithWhisperCpp } from "@/library/local-transcription";
import { errorResponse } from "@/server/api-helpers";
import { authorize } from "@/server/auth";
import { ProviderError } from "@/providers/voice/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const querySchema = z.object({
  format: z.enum(["srt", "vtt", "json"]).default("srt"),
  takeId: z.string().optional(),
  trackId: z.string().optional(),
});
const postSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("import"),
    format: z.enum(["srt", "vtt"]),
    content: z.string().min(1).max(2_000_000),
    trackId: z.string().optional(),
    label: z.string().trim().min(1).max(120).optional(),
    language: z.string().trim().min(2).max(24).optional(),
  }),
  z.object({
    action: z.literal("estimate"),
    takeId: z.string().optional(),
    trackId: z.string().optional(),
  }),
  z.object({
    action: z.literal("set_enabled"),
    trackId: z.string(),
    enabled: z.boolean(),
  }),
  z.object({
    action: z.literal("transcribe"),
    takeId: z.string(),
    trackId: z.string().optional(),
    language: z.string().trim().min(2).max(24).optional(),
  }),
]);

const CONTENT_TYPE = {
  srt: "application/x-subrip; charset=utf-8",
  vtt: "text/vtt; charset=utf-8",
} as const;

function safeFilename(name: string): string {
  const base = name
    .trim()
    .replace(/[^a-z0-9._-]+/gi, "-")
    .replace(/^[.-]+|[.-]+$/g, "");
  return base || "captions";
}

function estimatedCues(
  script: NonNullable<Awaited<ReturnType<typeof getScript>>>,
  takeId?: string,
): CaptionCue[] {
  const take =
    (takeId && script.takes.find((candidate) => candidate.id === takeId)) ||
    script.takes[0] ||
    null;
  const resolved = resolveReelTimeline(
    script.scenes.map((scene) => ({
      id: scene.id,
      text: resolveSpokenText(scene),
    })),
    take ? { timeline: take.timeline, totalFrames: take.totalFrames } : null,
    script.fps,
  );
  const textById = new Map(
    script.scenes.map((scene) => [scene.id, resolveSpokenText(scene)]),
  );
  return resolved.timeline.map((beat) => ({
    startFrame: beat.startFrame,
    endFrame: beat.startFrame + beat.durationFrames,
    text: textById.get(beat.sceneId) ?? "",
  }));
}

export async function GET(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await ctx.params;
    const { searchParams } = new URL(req.url);
    const { format, takeId, trackId } = querySchema.parse({
      format: searchParams.get("format") ?? undefined,
      takeId: searchParams.get("takeId") ?? undefined,
      trackId: searchParams.get("trackId") ?? undefined,
    });
    const script = await getScript(id);
    if (!script) return new Response("Script not found", { status: 404 });
    if (format === "json") {
      return Response.json({ tracks: script.captionTracks ?? [] });
    }
    const track = trackId
      ? script.captionTracks?.find((candidate) => candidate.id === trackId)
      : script.captionTracks?.find((candidate) => candidate.enabled);
    const offset = coverFrames(script.fps, Boolean(script.coverUrl));
    const cues = (track?.cues ?? estimatedCues(script, takeId)).map((cue) => ({
      ...cue,
      startFrame: cue.startFrame + offset,
      endFrame: cue.endFrame + offset,
    }));
    const body = buildCaptions(cues, script.fps, format);
    return new Response(body, {
      headers: {
        "content-type": CONTENT_TYPE[format],
        "content-disposition": `attachment; filename="${safeFilename(script.name)}.${format}"`,
        "cache-control": "no-store",
        "x-caption-timing-source": track?.timingSource ?? "estimated",
      },
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
    authorize(req);
    const { id: scriptId } = await ctx.params;
    const body = postSchema.parse(await req.json());
    const script = await getScript(scriptId);
    if (!script)
      return Response.json({ error: "Script not found" }, { status: 404 });
    if (body.action === "set_enabled") {
      const track = await setCaptionTrackEnabled(
        scriptId,
        body.trackId,
        body.enabled,
      );
      return Response.json({ track });
    }
    if (body.action === "transcribe") {
      const source = await getCaptionAudioSource(scriptId, body.takeId);
      const cues = await transcribeWithWhisperCpp({
        audio: await getAssetStore().get(source.audioPath),
        fps: script.fps,
        language: body.language,
      });
      const track = await replaceCaptionTrack({
        scriptId,
        trackId: body.trackId,
        label: "Local transcription",
        language: body.language,
        timingSource: "local-transcription",
        enabled: true,
        cues,
      });
      return Response.json({ track }, { status: body.trackId ? 200 : 201 });
    }
    const offset = coverFrames(script.fps, Boolean(script.coverUrl));
    let cues: CaptionCue[];
    if (body.action === "import") {
      try {
        cues = parseCaptions(body.content, script.fps, body.format).map(
          (cue) => ({
            ...cue,
            startFrame: Math.max(0, cue.startFrame - offset),
            endFrame: Math.max(1, cue.endFrame - offset),
          }),
        );
      } catch (error) {
        throw new ProviderError(
          error instanceof Error ? error.message : "Invalid caption file",
          400,
        );
      }
    } else {
      cues = estimatedCues(script, body.takeId);
    }
    const track = await replaceCaptionTrack({
      scriptId,
      trackId: body.trackId,
      label: body.action === "import" ? body.label : "Estimated subtitles",
      language: body.action === "import" ? body.language : undefined,
      timingSource: body.action === "import" ? "imported" : "estimated",
      enabled: true,
      cues,
    });
    return Response.json({ track }, { status: body.trackId ? 200 : 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
