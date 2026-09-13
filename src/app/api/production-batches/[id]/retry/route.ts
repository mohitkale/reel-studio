import { randomUUID } from "node:crypto";

import { after, NextResponse } from "next/server";

import { authorizeRequest } from "@/server/auth";
import { errorResponse } from "@/server/api-helpers";
import { retryProductionBatch } from "@/library/production-batch-service";
import { productionBatchView } from "@/library/production-batch-view";
import { drainProductionQueue } from "@/library/production-worker";
import { executeProductionJob } from "@/library/production-job-executor";

export const runtime = "nodejs";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const auth = authorizeRequest(req, "production:submit");
    const { id } = await params;
    const batch = await retryProductionBatch({
      id,
      auth,
      serverBaseUrl: new URL(req.url).origin,
    });
    if (!batch)
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    const view = productionBatchView(batch);
    const queued = view.items.filter((item) => item.state === "queued").length;
    if (queued) {
      after(() =>
        drainProductionQueue({
          workerId: `web-batch-retry:${randomUUID()}`,
          execute: executeProductionJob,
          maxJobs: queued,
        }),
      );
    }
    return NextResponse.json({ batch: view }, { status: 202 });
  } catch (error) {
    return errorResponse(error);
  }
}
