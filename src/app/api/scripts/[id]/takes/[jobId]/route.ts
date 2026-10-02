import { authorizeRead } from "@/server/auth";
import { NextResponse } from "next/server";

import { getEditorVoiceJob } from "@/library/editor-jobs";
import { errorResponse } from "@/server/api-helpers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Plain JSON poll for a voice-generation job's status (companion to the SSE
 * .../progress route). Used by non-browser callers (e.g. the MCP server) that
 * can't easily consume an EventSource.
 */
export async function GET(
  req: Request,
  ctx: { params: Promise<{ id: string; jobId: string }> },
) {
  try {
    authorizeRead(req);
    const { id, jobId } = await ctx.params;
    const job = await getEditorVoiceJob(jobId, id, false);
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
        error: job.error ?? null,
        take: job.take ?? null,
        clip: job.clip ?? null,
        clips: job.clips ?? null,
      },
    });
  } catch (e) {
    return errorResponse(e);
  }
}
