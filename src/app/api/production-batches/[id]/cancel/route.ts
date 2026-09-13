import { NextResponse } from "next/server";

import { authorizeRequest } from "@/server/auth";
import { errorResponse } from "@/server/api-helpers";
import { cancelProductionBatch } from "@/library/production-batch-service";
import { productionBatchView } from "@/library/production-batch-view";

export const runtime = "nodejs";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    authorizeRequest(req, "production:cancel");
    const { id } = await params;
    const batch = await cancelProductionBatch(id);
    if (!batch)
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ batch: productionBatchView(batch) });
  } catch (error) {
    return errorResponse(error);
  }
}
