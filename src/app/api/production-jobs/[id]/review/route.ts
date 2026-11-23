import { randomUUID } from "node:crypto";
import { after, NextResponse } from "next/server";
import { z } from "zod";

import {
  completedVideoFrame,
  getCompletedVideoReview,
  reviseCompletedHeadline,
} from "@/library/completed-video-review";
import { createProductionRevision } from "@/library/production-revision";
import { executeProductionJob } from "@/library/production-job-executor";
import { submitProduction } from "@/library/production-service";
import { runProductionWorkerOnce } from "@/library/production-worker";
import { projectToStoryboard } from "@/library/project-storyboard";
import { createVisualReview } from "@/library/visual-review";
import { productionQualitySchema } from "@/production/api";
import { authorizeRequest } from "@/server/auth";
import {
  errorResponse,
  parseClientInput,
  readRequestJson,
} from "@/server/api-helpers";
import { STORYBOARD_LIMITS } from "@/storyboard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Context = { params: Promise<{ id: string }> };
const querySchema = z
  .object({
    frameScene: z.coerce.number().int().positive().optional(),
    storyboardOnly: z.literal("1").optional(),
  })
  .strict();
const editSchema = z
  .object({
    index: z.number().int().positive(),
    from: z.string().min(1).max(STORYBOARD_LIMITS.headline),
    headline: z.string().trim().min(1).max(STORYBOARD_LIMITS.headline),
    quality: productionQualitySchema.optional(),
  })
  .strict();

export async function GET(req: Request, context: Context) {
  try {
    authorizeRequest(req, "studio:read");
    const url = new URL(req.url);
    const { frameScene, storyboardOnly } = parseClientInput(
      querySchema,
      Object.fromEntries(url.searchParams),
    );
    const { id } = await context.params;
    const completed = await getCompletedVideoReview(id);
    if (frameScene !== undefined) {
      const png = await completedVideoFrame(completed, frameScene, req.signal);
      return new Response(new Uint8Array(png), {
        headers: { "content-type": "image/png", "cache-control": "no-store" },
      });
    }
    const { snapshot, composition, video } = completed;
    const { props } = composition;
    const script = {
      ...snapshot.script,
      width: props.width,
      height: props.height,
    };
    const storyboard = await projectToStoryboard(script.id, script);
    if (storyboardOnly)
      return NextResponse.json({ storyboard: storyboard?.storyboard });
    const sceneIds = props.timeline.slice(0, 8).map((beat) => beat.sceneId);
    const visual = await createVisualReview(
      script.id,
      { sceneIds },
      url.origin,
      req.signal,
      { ...snapshot, script },
    ).catch(() => {
      req.signal.throwIfAborted();
      return null;
    });
    const metadata = z
      .object({
        audioMastering: z.unknown().optional(),
        hasAudio: z.boolean().optional(),
      })
      .parse(JSON.parse(video.metadataJson ?? "{}"));
    return NextResponse.json({
      storyboard: storyboard?.storyboard,
      frameCheck: {
        status: "unavailable",
        ...visual?.layoutReview,
        findings: visual?.findings ?? [],
        sampledScenes: visual ? sceneIds.length : 0,
        totalScenes: props.timeline.length,
      },
      audio: metadata,
      timeline: props.timeline.map(
        ({ durationFrames }) => durationFrames / props.fps,
      ),
    });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(req: Request, context: Context) {
  try {
    authorizeRequest(req, "studio:write");
    const auth = authorizeRequest(req, "production:submit");
    const edit = parseClientInput(editSchema, await readRequestJson(req));
    const { id } = await context.params;
    const { snapshot, input } = await getCompletedVideoReview(id);
    const revised = reviseCompletedHeadline(
      snapshot,
      edit.index,
      edit.from,
      edit.headline,
    );
    if (!revised) return NextResponse.json({ supported: false });
    const revision = await createProductionRevision(revised);
    const job = await submitProduction({
      request: {
        kind: "video",
        scriptId: revised.script.id,
        revisionId: revision.id,
        voiceTakeId: revised.take?.id,
        orientation: input.orientation,
        quality: edit.quality ?? input.quality,
        captions: input.captions,
        storyboard: {
          hash: revision.revisionHash,
          title:
            input.storyboard?.title ??
            (revised.script.name.trim() || "Video").slice(
              0,
              STORYBOARD_LIMITS.title,
            ),
          fixes: [],
          warnings: input.storyboard?.warnings ?? [],
        },
        runMode: "automatic",
        priority: 0,
        idempotencyKey: randomUUID(),
      },
      auth,
      serverBaseUrl: new URL(req.url).origin,
    });
    if (!job) throw new Error("Could not queue the revised video");
    if (job.state === "queued") {
      after(() =>
        runProductionWorkerOnce({
          workerId: `web-review:${randomUUID()}`,
          execute: executeProductionJob,
        }),
      );
    }
    return NextResponse.json(
      {
        supported: true,
        jobId: job.id,
        projectId: revised.script.projectId,
        state: job.state,
      },
      { status: 202 },
    );
  } catch (error) {
    return errorResponse(error);
  }
}
