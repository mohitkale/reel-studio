import { errorResponse } from "@/server/api-helpers";
import { authorizeRead } from "@/server/auth";
import { getEditorVoiceJob } from "@/library/editor-jobs";
import { progressResponse } from "@/server/progress-stream";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(
  req: Request,
  ctx: { params: Promise<{ id: string; jobId: string }> },
) {
  try {
    authorizeRead(req);
    const { id, jobId } = await ctx.params;
    const read = () => getEditorVoiceJob(jobId, id, true);
    const initial = await read();
    if (!initial)
      return Response.json({ error: "Job not found" }, { status: 404 });
    return progressResponse(
      req,
      initial,
      read,
      (job) => job.status === "done" || job.status === "error",
    );
  } catch (error) {
    return errorResponse(error);
  }
}
