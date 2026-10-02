import { authorizeRead } from "@/server/auth";
import { NextResponse } from "next/server";

import { getEditorVoiceJob } from "@/library/editor-jobs";
import { errorResponse } from "@/server/api-helpers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  req: Request,
  ctx: { params: Promise<{ id: string; jobId: string }> },
) {
  try {
    authorizeRead(req);
    const { id, jobId } = await ctx.params;
    const job = await getEditorVoiceJob(jobId, id, true);
    if (!job) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }
    return NextResponse.json({
      job: {
        id: job.id,
        status: job.status,
        scene: job.scene,
        sceneCount: job.sceneCount,
        workingOn: job.workingOn ?? null,
        cached: job.cached ?? 0,
        generated: job.generated ?? 0,
        error: job.error ?? null,
        podcastTake: job.podcastTake ?? null,
      },
    });
  } catch (e) {
    return errorResponse(e);
  }
}
