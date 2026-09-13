import { randomUUID } from "node:crypto";

import { after, NextResponse } from "next/server";

import { authorizeRequest } from "@/server/auth";
import { errorResponse } from "@/server/api-helpers";
import { retryProductionJob } from "@/library/repositories/production-jobs";
import { runProductionWorkerOnce } from "@/library/production-worker";
import { executeProductionJob } from "@/library/production-job-executor";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  req: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    authorizeRequest(req, "production:submit");
    const { id } = await context.params;
    const job = await retryProductionJob(id);
    if (!job) {
      return NextResponse.json(
        { error: "Only failed or canceled production jobs can be retried" },
        { status: 409 },
      );
    }
    after(() =>
      runProductionWorkerOnce({
        workerId: `web-production:${randomUUID()}`,
        execute: executeProductionJob,
      }),
    );
    return NextResponse.json({ id: job.id, state: job.state }, { status: 202 });
  } catch (error) {
    return errorResponse(error);
  }
}
