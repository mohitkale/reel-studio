import { NextResponse } from "next/server";

import { getVoiceJob } from "@/lib/voice-queue";
import { errorResponse } from "@/server/api-helpers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Plain JSON poll for a voice-generation job's status (companion to the SSE
 * .../progress route). Used by non-browser callers (e.g. the MCP server) that
 * can't easily consume an EventSource.
 */
export async function GET(
  _req: Request,
  ctx: { params: Promise<{ jobId: string }> },
) {
  try {
    const { jobId } = await ctx.params;
    const job = getVoiceJob(jobId);
    if (!job) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }
    return NextResponse.json({
      job: {
        id: job.id,
        status: job.status,
        scene: job.scene,
        sceneCount: job.sceneCount,
        error: job.error ?? null,
        take: job.take ?? null,
      },
    });
  } catch (e) {
    return errorResponse(e);
  }
}
