import { NextResponse } from "next/server";

import type { PodcastAudiogramJobDTO } from "@/lib/dto";
import { getAssetStore } from "@/library/storage";
import { getProductionJob } from "@/library/repositories/production-jobs";
import { errorResponse } from "@/server/api-helpers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ jobId: string }> },
) {
  try {
    const { jobId } = await ctx.params;
    const job = await getProductionJob(jobId);
    if (!job || job.kind !== "audiogram") {
      return NextResponse.json(
        { error: "Audiogram job not found" },
        { status: 404 },
      );
    }
    const active =
      job.steps.find((step) => step.state === "running") ?? job.steps.at(-1);
    const progress =
      job.state === "succeeded"
        ? 1
        : job.steps.length
          ? job.steps.reduce((sum, step) => sum + step.progress, 0) / 8
          : 0;
    const output = job.outputs.find(
      (candidate) =>
        candidate.kind === "audiogram" && candidate.format === "mp4",
    );
    const response: PodcastAudiogramJobDTO = {
      id: job.id,
      state: job.state as PodcastAudiogramJobDTO["state"],
      progress,
      activeStep: active?.key ?? null,
      error: job.error,
      outputUrl: output ? getAssetStore().url(output.path) : null,
    };
    return NextResponse.json({ job: response });
  } catch (error) {
    return errorResponse(error);
  }
}
