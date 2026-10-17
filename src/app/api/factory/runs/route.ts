import { NextResponse } from "next/server";
import { authorizeRequest } from "@/server/auth";
import {
  errorResponse,
  readRequestJson,
  parseClientInput,
} from "@/server/api-helpers";
import { factoryRunRequestSchema } from "@/production/factory";
import { submitFactoryRun } from "@/library/factory-service";
import { wakeFactoryQueue } from "@/library/factory-routes";
export const runtime = "nodejs";
export async function POST(req: Request) {
  try {
    const auth = authorizeRequest(req, "production:submit"),
      request = parseClientInput(
        factoryRunRequestSchema,
        await readRequestJson(req),
      );
    const run = await submitFactoryRun({
      request,
      auth,
      serverBaseUrl: new URL(req.url).origin,
    });
    wakeFactoryQueue(
      run.batch?.items.filter((item) => item.state === "queued").length ?? 0,
    );
    return NextResponse.json({ run }, { status: 202 });
  } catch (error) {
    return errorResponse(error);
  }
}
