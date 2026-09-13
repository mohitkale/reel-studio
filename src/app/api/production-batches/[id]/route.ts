import { NextResponse } from "next/server";

import { authorizeRequest } from "@/server/auth";
import { errorResponse } from "@/server/api-helpers";
import { getProductionBatch } from "@/library/repositories/production-batches";
import { productionBatchView } from "@/library/production-batch-view";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    authorizeRequest(req, "production:submit");
    const { id } = await params;
    const batch = await getProductionBatch(id);
    if (!batch)
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ batch: productionBatchView(batch) });
  } catch (error) {
    return errorResponse(error);
  }
}
