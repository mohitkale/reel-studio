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
import { mediaVisionRequestSchema } from "@/production/media-vision";
import {
  startMediaRanking,
  runMediaRanking,
  readMediaRankingContext,
} from "@/library/media-ranking-service";
export const runtime = "nodejs";
export const maxDuration = 60;
export async function GET(
  req: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    authorizeRead(req);
    const { id } = await context.params;
    return NextResponse.json(
      await readMediaRankingContext(
        id,
        new URL(req.url).searchParams.get("sceneId") ?? undefined,
      ),
      { headers: { "cache-control": "no-store" } },
    );
  } catch (error) {
    return errorResponse(error);
  }
}
export async function POST(
  req: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    authorizeRequest(req, "studio:write");
    const { id } = await context.params,
      input = parseClientInput(
        mediaVisionRequestSchema,
        await readRequestJson(req),
      );
    const job = await startMediaRanking(id, input);
    if (job.state === "queued")
      after(async () => {
        await runMediaRanking(id, job.id, () =>
          authorizeProviderRequest(req, ["openai"]),
        );
      });
    return NextResponse.json({ job }, { status: 202 });
  } catch (error) {
    return errorResponse(error);
  }
}
