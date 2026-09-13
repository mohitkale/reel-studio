import { randomUUID } from "node:crypto";

import { after, NextResponse } from "next/server";

import { authorizeRequest } from "@/server/auth";
import { errorResponse } from "@/server/api-helpers";
import { productionBatchRequestSchema } from "@/production/batch";
import { submitProductionBatch } from "@/library/production-batch-service";
import { productionBatchView } from "@/library/production-batch-view";
import { listProductionBatches } from "@/library/repositories/production-batches";
import { drainProductionQueue } from "@/library/production-worker";
import { executeProductionJob } from "@/library/production-job-executor";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    authorizeRequest(req, "production:submit");
    const limit = Number(new URL(req.url).searchParams.get("limit") ?? 25);
    const batches = await listProductionBatches(
      Number.isFinite(limit) ? limit : 25,
    );
    return NextResponse.json({ batches: batches.map(productionBatchView) });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(req: Request) {
  try {
    const auth = authorizeRequest(req, "production:submit");
    const request = productionBatchRequestSchema.parse(await req.json());
    const batch = await submitProductionBatch({
      request,
      auth,
      serverBaseUrl: new URL(req.url).origin,
    });
    const view = productionBatchView(batch);
    const queued = view.items.filter((item) => item.state === "queued").length;
    if (queued) {
      after(() =>
        drainProductionQueue({
          workerId: `web-batch:${randomUUID()}`,
          execute: executeProductionJob,
          maxJobs: queued,
        }),
      );
    }
    return NextResponse.json(
      {
        batch: view,
        approvalUrl:
          view.state === "awaiting_approval" ? "/renders" : undefined,
      },
      { status: 202 },
    );
  } catch (error) {
    return errorResponse(error);
  }
}
