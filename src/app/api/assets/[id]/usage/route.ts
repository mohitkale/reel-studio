import { authorizeRead } from "@/server/auth";
import { errorResponse } from "@/server/api-helpers";
import { getAssetUsage } from "@/library/asset-usage";
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    authorizeRead(req);
    const usage = await getAssetUsage((await params).id);
    return usage
      ? Response.json(usage)
      : Response.json({ error: "Asset not found" }, { status: 404 });
  } catch (e) {
    return errorResponse(e);
  }
}
