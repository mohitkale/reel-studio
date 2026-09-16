import { randomUUID } from "node:crypto";

import { after, NextResponse } from "next/server";

import { executeProductionJob } from "@/library/production-job-executor";
import { productionJobViewWithRevision } from "@/library/production-job-view";
import { getProductionJob } from "@/library/repositories/production-jobs";
import { submitProduction } from "@/library/production-service";
import { runProductionWorkerOnce } from "@/library/production-worker";
import { videoProductionJobInputSchema } from "@/production/jobs";
import { authorizeRequest } from "@/server/auth";
import { errorResponse } from "@/server/api-helpers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  req: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const auth = authorizeRequest(req, "production:submit");
    const { id } = await context.params;
    const source = await getProductionJob(id);
    if (!source) {
      return NextResponse.json(
        { error: "Production job not found" },
        { status: 404 },
      );
    }
    const input = videoProductionJobInputSchema.parse(
      JSON.parse(source.inputSnapshot),
    );
    if (!input.quickProduce) {
      return NextResponse.json(
        { error: "This is not a Quick Produce job" },
        { status: 400 },
      );
    }
    const job = await submitProduction({
      request: {
        kind: "video",
        scriptId: input.scriptId,
        orientation: input.orientation,
        quality: input.quality,
        idempotencyKey: `quick-produce:${randomUUID()}`,
        runMode: "automatic",
        priority: source.priority,
        quickProduce: input.quickProduce,
      },
      auth,
      serverBaseUrl: new URL(req.url).origin,
    });
    if (!job) throw new Error("Production job could not be created");
    if (job.state === "queued") {
      after(() =>
        runProductionWorkerOnce({
          workerId: `web-quick-produce:${randomUUID()}`,
          execute: executeProductionJob,
        }),
      );
    }
    return NextResponse.json(
      { job: await productionJobViewWithRevision(job) },
      { status: 202 },
    );
  } catch (error) {
    return errorResponse(error);
  }
}
