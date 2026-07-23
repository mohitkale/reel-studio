import { NextResponse } from "next/server";

import { getVoiceJob } from "@/lib/voice-queue";
import { errorResponse } from "@/server/api-helpers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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
        workingOn: job.workingOn ?? null,
        error: job.error ?? null,
        podcastTake: job.podcastTake ?? null,
      },
    });
  } catch (e) {
    return errorResponse(e);
  }
}
