import { NextResponse } from "next/server";

import { getProductionJob } from "@/library/repositories/production-jobs";
import { restoreProductionRevision } from "@/library/restore-production-revision";
import { authorizeRequest } from "@/server/auth";
import { errorResponse } from "@/server/api-helpers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  req: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    authorizeRequest(req, "production:submit");
    const { id } = await context.params;
    const job = await getProductionJob(id);
    if (!job?.productionRevision) {
      return NextResponse.json(
        { error: "Production revision not found" },
        { status: 404 },
      );
    }
    const restored = await restoreProductionRevision(
      JSON.parse(job.productionRevision.snapshotJson),
    );
    return NextResponse.json(restored, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
