import { NextResponse } from "next/server";
import {
  authorizeRequest,
  authorizeRead,
  authorizeProviderRequest,
} from "@/server/auth";
import {
  errorResponse,
  parseClientInput,
  readRequestJson,
} from "@/server/api-helpers";
import { editorialReviewControlSchema } from "@/production/editorial-review";
import {
  controlEditorialReview,
  readEditorialReview,
} from "@/library/editorial-review";
export const runtime = "nodejs";
export const maxDuration = 60;
export async function GET(
  req: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    authorizeRead(req);
    const { id } = await context.params;
    return NextResponse.json(await readEditorialReview(id), {
      headers: { "cache-control": "no-store" },
    });
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
    const { id } = await context.params;
    const input = parseClientInput(
      editorialReviewControlSchema,
      await readRequestJson(req),
    );
    return NextResponse.json({
      proposal: await controlEditorialReview(
        id,
        input,
        (provider) => authorizeProviderRequest(req, [provider]),
        req.signal,
      ),
    });
  } catch (error) {
    return errorResponse(error);
  }
}
