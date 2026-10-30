import { NextResponse } from "next/server";
import { authorizeRequest } from "@/server/auth";
import {
  errorResponse,
  parseClientInput,
  readRequestJson,
} from "@/server/api-helpers";
import { storyboardControlSchema } from "@/production/editorial-storyboard";
import { controlEditorialStoryboard } from "@/library/editorial-storyboard";
export const runtime = "nodejs";
export async function POST(
  req: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    authorizeRequest(req, "studio:write");
    const { id } = await context.params;
    const input = parseClientInput(
      storyboardControlSchema,
      await readRequestJson(req),
    );
    return NextResponse.json({
      storyboard: await controlEditorialStoryboard(id, input),
    });
  } catch (error) {
    return errorResponse(error);
  }
}
