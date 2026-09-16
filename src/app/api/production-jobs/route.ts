import { randomUUID } from "node:crypto";

import { after, NextResponse } from "next/server";

import { produceContentRequestSchema } from "@/production/api";
import { authorizeRequest } from "@/server/auth";
import { errorResponse } from "@/server/api-helpers";
import { submitProduction } from "@/library/production-service";
import {
  productionJobView,
  productionJobViewWithRevision,
} from "@/library/production-job-view";
import { listProductionJobs } from "@/library/repositories/production-jobs";
import { runProductionWorkerOnce } from "@/library/production-worker";
import { executeProductionJob } from "@/library/production-job-executor";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    authorizeRequest(req, "production:submit");
    const limit = Number(new URL(req.url).searchParams.get("limit") ?? 50);
    const jobs = await listProductionJobs(Number.isFinite(limit) ? limit : 50);
    return NextResponse.json({
      jobs: await Promise.all(jobs.map(productionJobViewWithRevision)),
    });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(req: Request) {
  try {
    const auth = authorizeRequest(req, "production:submit");
    const request = produceContentRequestSchema.parse(await req.json());
    const job = await submitProduction({
      request,
      auth,
      serverBaseUrl: new URL(req.url).origin,
    });
    if (!job) throw new Error("Production job could not be created");
    if (job.state === "queued") {
      after(() =>
        runProductionWorkerOnce({
          workerId: `web-production:${randomUUID()}`,
          execute: executeProductionJob,
        }),
      );
    }
    return NextResponse.json(
      {
        job: await productionJobViewWithRevision(job),
        approvalUrl: job.state === "awaiting_approval" ? "/renders" : undefined,
      },
      { status: 202 },
    );
  } catch (error) {
    return errorResponse(error);
  }
}
