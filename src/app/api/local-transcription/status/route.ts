import { getLocalTranscriptionStatus } from "@/library/local-transcription";
import { errorResponse } from "@/server/api-helpers";
import { authorize } from "@/server/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    authorize(req);
    const status = await getLocalTranscriptionStatus();
    return Response.json({ status });
  } catch (error) {
    return errorResponse(error);
  }
}
