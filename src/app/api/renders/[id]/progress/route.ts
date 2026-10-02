import { errorResponse } from "@/server/api-helpers";
import { authorizeRead } from "@/server/auth";
import { getRender } from "@/library/repositories/renders";
import { progressResponse } from "@/server/progress-stream";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    authorizeRead(req);
    const { id } = await ctx.params;
    const read = () => getRender(id);
    const initial = await read();
    if (!initial)
      return Response.json({ error: "Render not found" }, { status: 404 });
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
