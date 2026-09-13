import { authorizeRequest } from "@/server/auth";
import { errorResponse } from "@/server/api-helpers";
import { collectStudioDiagnostics } from "@/library/studio-diagnostics";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    authorizeRequest(req, "studio:read");
    return Response.json({ report: await collectStudioDiagnostics() });
  } catch (error) {
    return errorResponse(error);
  }
}
