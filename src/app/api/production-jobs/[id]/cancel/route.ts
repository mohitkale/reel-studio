import { NextResponse } from "next/server";

import { authorizeRequest } from "@/server/auth";
import { errorResponse } from "@/server/api-helpers";
import { requestProductionJobCancellation } from "@/library/repositories/production-jobs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  req: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    authorizeRequest(req, "production:cancel");
    const { id } = await context.params;
    const job = await requestProductionJobCancellation(id);
    if (!job) {
      return NextResponse.json(
        { error: "Production job not found" },
        { status: 404 },
      );
    }
    return NextResponse.json({ id: job.id, state: job.state });
  } catch (error) {
    return errorResponse(error);
  }
}
