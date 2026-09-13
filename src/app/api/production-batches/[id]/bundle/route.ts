import { Readable } from "node:stream";

import { authorizeRequest } from "@/server/auth";
import { errorResponse } from "@/server/api-helpers";
import { getProductionBatch } from "@/library/repositories/production-batches";
import {
  createProductionBundleStream,
  productionBatchBundleEntries,
} from "@/library/production-bundle";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    authorizeRequest(req, "artifacts:read");
    const { id } = await params;
    const batch = await getProductionBatch(id);
    if (!batch) return Response.json({ error: "Not found" }, { status: 404 });
    const entries = await productionBatchBundleEntries(batch);
    const stream = createProductionBundleStream(entries);
    return new Response(Readable.toWeb(stream) as ReadableStream, {
      headers: {
        "Content-Type": "application/gzip",
        "Content-Disposition": `attachment; filename="reel-studio-batch-${id}.tar.gz"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
