import { randomUUID } from "node:crypto";

import { after, NextResponse } from "next/server";

import { listPodcastTakes } from "@/library/repositories/podcasts";
import { generatePodcastTake } from "@/library/podcast-take-service";
import { getVoiceJob, upsertVoiceJob } from "@/lib/voice-queue";
import { authorize } from "@/server/auth";
import { errorResponse } from "@/server/api-helpers";
import { z } from "zod";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const generatePodcastTakeSchema = z.object({
  regenerateTurnIds: z.array(z.string().min(1)).max(120).optional(),
});

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
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
    authorize(req);
    const { id } = await ctx.params;
    const body = generatePodcastTakeSchema.parse(
      await req.json().catch(() => ({})),
    );
    const jobId = randomUUID();
    upsertVoiceJob({ id: jobId, status: "queued", scene: 0, sceneCount: 0 });

    after(() =>
      generatePodcastTake({
        podcastId: id,
        regenerateTurnIds: body.regenerateTurnIds,
        onProgress: (progress) => {
          const current = getVoiceJob(jobId);
          upsertVoiceJob({
            id: jobId,
            status: progress.phase,
            scene: progress.scene,
            sceneCount: progress.sceneCount,
            workingOn:
              progress.phase === "synthesizing"
                ? progress.workingOn
                : undefined,
            cached:
              progress.phase === "synthesizing"
                ? progress.cached
                : current?.cached,
            generated:
              progress.phase === "synthesizing"
                ? progress.generated
                : current?.generated,
          });
        },
      })
        .then((podcastTake) => {
          const last = getVoiceJob(jobId);
          upsertVoiceJob({
            id: jobId,
            status: "done",
            scene: podcastTake.timeline.length,
            sceneCount: last?.sceneCount ?? podcastTake.timeline.length,
            cached: last?.cached,
            generated: last?.generated,
            podcastTake,
          });
        })
        .catch((err) => {
          const message = err instanceof Error ? err.message : String(err);
          const last = getVoiceJob(jobId);
          console.error("[podcast-takes] generatePodcastTake failed:", message);
          upsertVoiceJob({
            id: jobId,
            status: "error",
            scene: 0,
            sceneCount: 0,
            cached: last?.cached,
            generated: last?.generated,
            error: message,
          });
        }),
    );

    return NextResponse.json({ jobId }, { status: 202 });
  } catch (e) {
    return errorResponse(e);
  }
}
