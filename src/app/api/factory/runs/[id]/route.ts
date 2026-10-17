import { NextResponse } from "next/server";
import { authorizeRequest } from "@/server/auth";
import {
  errorResponse,
  readRequestJson,
  parseClientInput,
} from "@/server/api-helpers";
import { getFactoryRun, submitFactoryRun } from "@/library/factory-service";
import { factoryRunRequestSchema } from "@/production/factory";
import {
  cancelProductionBatch,
  retryProductionBatch,
  approveProductionBatch,
} from "@/library/production-batch-service";
import { wakeFactoryQueue } from "@/library/factory-routes";
import { ProviderError } from "@/providers/voice/types";
import { z } from "zod";
export const runtime = "nodejs";
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    authorizeRequest(req, "studio:read");
    const run = await getFactoryRun((await params).id);
    return run
      ? NextResponse.json({ run })
      : NextResponse.json({ error: "Not found" }, { status: 404 });
  } catch (error) {
    return errorResponse(error);
  }
}
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    authorizeRequest(req);
    const id = (await params).id,
      { action } = parseClientInput(
        z.object({ action: z.enum(["cancel", "resume", "approve"]) }).strict(),
        await readRequestJson(req),
      );
    const auth = authorizeRequest(
      req,
      action === "cancel" ? "production:cancel" : "production:submit",
    );
    let run = await getFactoryRun(id);
    if (!run) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (!run.batchId) {
      if (action !== "resume")
        return NextResponse.json(
          { error: "Resume submission before controlling its batch" },
          { status: 409 },
        );
      run = await submitFactoryRun({
        request: factoryRunRequestSchema.parse(run.request),
        auth,
        serverBaseUrl: new URL(req.url).origin,
      });
    } else if (action === "cancel") await cancelProductionBatch(run.batchId);
    else if (action === "approve") {
      if (auth.origin !== "web")
        throw new ProviderError("Approve this run in the studio", 403);
      await approveProductionBatch(run.batchId);
    } else
      await retryProductionBatch({
        id: run.batchId,
        auth,
        serverBaseUrl: new URL(req.url).origin,
      });
    run = (await getFactoryRun(id))!;
    wakeFactoryQueue(
      run.batch?.items.filter((item) => item.state === "queued").length ?? 0,
    );
    return NextResponse.json({ run }, { status: 202 });
  } catch (error) {
    return errorResponse(error);
  }
}
