import { NextResponse } from "next/server";

import { authorizeRequest } from "@/server/auth";
import { errorResponse } from "@/server/api-helpers";
import { productionJobView } from "@/library/production-job-view";
import { getProductionJob } from "@/library/repositories/production-jobs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  req: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    authorizeRequest(req, "production:submit");
    const { id } = await context.params;
    const job = await getProductionJob(id);
    if (!job) {
      return NextResponse.json(
        { error: "Production job not found" },
        { status: 404 },
      );
    }
    return NextResponse.json({ job: productionJobView(job) });
  } catch (error) {
    return errorResponse(error);
  }
}
