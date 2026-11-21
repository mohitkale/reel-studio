import { randomUUID } from "node:crypto";
import { after, NextResponse } from "next/server";

import { executeProductionJob } from "@/library/production-job-executor";
import { drainProductionQueue } from "@/library/production-worker";
import { makeResultSizes } from "@/library/result-sizes";
import { errorResponse } from "@/server/api-helpers";
import { authorizeRequest } from "@/server/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  req: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const auth = authorizeRequest(req, "production:submit");
    const { id } = await context.params;
    const { sizes, queued } = await makeResultSizes(
      id,
      auth,
      new URL(req.url).origin,
    );
    if (queued.length > 0) {
      after(() =>
        drainProductionQueue({
          workerId: `web-result-sizes:${randomUUID()}`,
          execute: executeProductionJob,
          maxJobs: queued.length,
        }),
      );
    }
    return NextResponse.json({ sizes }, { status: queued.length ? 202 : 200 });
  } catch (error) {
    return errorResponse(error);
  }
}
