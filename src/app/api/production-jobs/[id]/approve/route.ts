import { randomUUID } from "node:crypto";

import { after, NextResponse } from "next/server";

import { requireWeb } from "@/server/auth";
import { errorResponse } from "@/server/api-helpers";
import { approveProductionJob } from "@/library/repositories/production-jobs";
import { runProductionWorkerOnce } from "@/library/production-worker";
import { executeProductionJob } from "@/library/production-job-executor";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  req: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    requireWeb(req);
    const { id } = await context.params;
    const job = await approveProductionJob(id);
    if (!job) {
      return NextResponse.json(
        { error: "Production job is not awaiting approval" },
        { status: 409 },
      );
    }
    after(() =>
      runProductionWorkerOnce({
        workerId: `approved-production:${randomUUID()}`,
        execute: executeProductionJob,
      }),
    );
    return NextResponse.json({ id: job.id, state: job.state }, { status: 202 });
  } catch (error) {
    return errorResponse(error);
  }
}
