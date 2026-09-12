import { NextResponse } from "next/server";

import { authorizeRequest } from "@/server/auth";
import { errorResponse } from "@/server/api-helpers";
import { getProductionJob } from "@/library/repositories/production-jobs";
import { productionJobView } from "@/library/production-job-view";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  req: Request,
  context: { params: Promise<{ id: string; outputId: string }> },
) {
  try {
    authorizeRequest(req, "artifacts:read");
    const { id, outputId } = await context.params;
    const job = await getProductionJob(id);
    if (!job) {
      return NextResponse.json(
        { error: "Production job not found" },
        { status: 404 },
      );
    }
    const output = productionJobView(job).outputs.find(
      (candidate) => candidate.id === outputId,
    );
    if (!output) {
      return NextResponse.json(
        { error: "Production artifact not found" },
        { status: 404 },
      );
    }
    return NextResponse.json({ artifact: output });
  } catch (error) {
    return errorResponse(error);
  }
}
