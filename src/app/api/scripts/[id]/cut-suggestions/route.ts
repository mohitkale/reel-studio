import { NextResponse } from "next/server";
import { authorize } from "@/server/auth";
import { errorResponse, readRequestJson } from "@/server/api-helpers";
import { cutSuggestionRequestSchema } from "@/production/cut-suggestions";
import { proposeNarrationCuts } from "@/library/cut-suggestion-service";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    authorize(req);
    const body = cutSuggestionRequestSchema.safeParse(
      await readRequestJson(req),
    );
    if (!body.success)
      return NextResponse.json(
        {
          error:
            "Review the music map and select a take before requesting cuts.",
        },
        { status: 400 },
      );
    const { id } = await ctx.params;
    return NextResponse.json(
      await proposeNarrationCuts(id, body.data, new URL(req.url).origin),
    );
  } catch (error) {
    return errorResponse(error);
  }
}
