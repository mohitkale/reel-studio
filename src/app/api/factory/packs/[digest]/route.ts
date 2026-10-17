import { Readable } from "node:stream";
import { authorizeRequest } from "@/server/auth";
import { errorResponse } from "@/server/api-helpers";
import { factoryPackEntries } from "@/library/factory-packs";
import { createProductionBundleStream } from "@/library/production-bundle";
export const runtime = "nodejs";
export async function GET(
  req: Request,
  { params }: { params: Promise<{ digest: string }> },
) {
  try {
    authorizeRequest(req, "artifacts:read");
    const digest = (await params).digest,
      entries = await factoryPackEntries(digest);
    return new Response(
      Readable.toWeb(createProductionBundleStream(entries)) as ReadableStream,
      {
        headers: {
          "Content-Type": "application/gzip",
          "Content-Disposition":
            'attachment; filename="reel-studio-adaptive-pack.tar.gz"',
          "Cache-Control": "private, no-store",
        },
      },
    );
  } catch (error) {
    return errorResponse(error);
  }
}
