import { z } from "zod";
import { speechWordsMatchText } from "@/lib/speech-words";

import { coverFrames } from "@/video/types";
import { buildCaptions, parseCaptions, type CaptionCue } from "@/lib/captions";
import {
  captionStyleForProductionPreset,
  captionStyleSnapshotSchema,
} from "@/lib/caption-style";
import { resolveReelTimeline } from "@/lib/reel-timeline";
import { resolveSpokenText } from "@/lib/spoken-text";
import {
  getCaptionAudioSource,
  replaceCaptionTrack,
  setCaptionTrackEnabled,
  updateCaptionTrackStyle,
} from "@/library/repositories/captions";
import { getScript } from "@/library/repositories/scripts";
import { getAssetStore } from "@/library/storage";
import { transcribeWithWhisperCpp } from "@/library/local-transcription";
import {
  errorResponse,
  parseClientInput,
  readRequestJson,
} from "@/server/api-helpers";
import { authorize, authorizeRead } from "@/server/auth";
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
    action: z.literal("set_style"),
    trackId: z.string(),
    style: captionStyleSnapshotSchema,
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
  return resolved.timeline.map((beat) => {
    const text = textById.get(beat.sceneId) ?? "";
    const words =
      resolved.takeUsable && take?.fps === script.fps
        ? take.timeline.find(
            (recorded) => recorded.startFrame === beat.startFrame,
          )?.words
        : undefined;
    return {
      startFrame: beat.startFrame,
      endFrame: beat.startFrame + beat.durationFrames,
      text,
      words:
        words?.length && speechWordsMatchText(text, words) ? words : undefined,
    };
  });
}

export async function GET(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    authorizeRead(req);
    const { id } = await ctx.params;
    const { searchParams } = new URL(req.url);
    const { format, takeId, trackId } = parseClientInput(querySchema, {
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
      words: cue.words?.map((word) => ({
        ...word,
        startFrame: word.startFrame + offset,
        endFrame: word.endFrame + offset,
      })),
    }));
    const body = buildCaptions(cues, script.fps, format);
    return new Response(body, {
      headers: {
        "content-type": CONTENT_TYPE[format],
        "content-disposition": `attachment; filename="${safeFilename(script.name)}.${format}"`,
        "cache-control": "no-store",
        "x-caption-timing-source":
          track?.timingSource ??
          (cues.length && cues.every((cue) => cue.words?.length)
            ? "provider"
            : "estimated"),
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
    const body = parseClientInput(postSchema, await readRequestJson(req));
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
    if (body.action === "set_style") {
      const track = await updateCaptionTrackStyle(
        scriptId,
        body.trackId,
        body.style,
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
        sourceTakeId: body.takeId,
        sourceFps: script.fps,
        enabled: true,
        style:
          script.captionTracks?.find(
            (candidate) => candidate.id === body.trackId,
          )?.style ??
          captionStyleForProductionPreset(script.productionPreset?.id),
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
    const measured =
      body.action !== "import" &&
      cues.length > 0 &&
      cues.every((cue) => cue.words?.length);
    if (!measured && body.action !== "import")
      cues = cues.map((cue) => ({ ...cue, words: undefined }));
    const sourceTake = measured
      ? (body.takeId && script.takes.find((take) => take.id === body.takeId)) ||
        script.takes[0]
      : null;
    const track = await replaceCaptionTrack({
      scriptId,
      trackId: body.trackId,
      sourceTakeId: sourceTake?.id,
      sourceFps: sourceTake?.fps,
      label:
        body.action === "import"
          ? body.label
          : measured
            ? "Provider subtitles"
            : "Estimated subtitles",
      language: body.action === "import" ? body.language : undefined,
      timingSource:
        body.action === "import"
          ? "imported"
          : measured
            ? "provider"
            : "estimated",
      enabled: true,
      style:
        script.captionTracks?.find((candidate) => candidate.id === body.trackId)
          ?.style ??
        captionStyleForProductionPreset(script.productionPreset?.id),
      cues,
    });
    return Response.json({ track }, { status: body.trackId ? 200 : 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
