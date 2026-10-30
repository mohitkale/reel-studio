import { after, NextResponse } from "next/server";
import {
  authorizeRead,
  authorizeRequest,
  authorizeProviderRequest,
} from "@/server/auth";
import {
  parseClientInput,
  readRequestJson,
  errorResponse,
} from "@/server/api-helpers";
import { mediaVisionControlSchema } from "@/production/media-vision";
import { controlMediaRankingJob } from "@/library/repositories/media-ranking-jobs";
import {
  readMediaRanking,
  runMediaRanking,
} from "@/library/media-ranking-service";
export const runtime = "nodejs";
export const maxDuration = 60;
type Context = { params: Promise<{ id: string; jobId: string }> };
export async function GET(req: Request, context: Context) {
  try {
    authorizeRead(req);
    const { id, jobId } = await context.params;
    return NextResponse.json(await readMediaRanking(id, jobId), {
      headers: { "cache-control": "no-store" },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
export async function POST(req: Request, context: Context) {
  try {
    authorizeRequest(req, "studio:write");
    const { id, jobId } = await context.params,
      input = parseClientInput(
        mediaVisionControlSchema,
        await readRequestJson(req),
      );
    const job = await controlMediaRankingJob(id, jobId, input.action);
    if (input.action === "resume" && job.state === "queued")
      after(async () => {
        await runMediaRanking(id, jobId, () =>
          authorizeProviderRequest(req, ["openai"]),
        );
      });
    return NextResponse.json({ job });
  } catch (error) {
    return errorResponse(error);
  }
}
