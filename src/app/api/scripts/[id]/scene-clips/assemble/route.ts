import { NextResponse } from "next/server";

import { assembleVoiceTake } from "@/library/scene-voice-service";
import { authorize } from "@/server/auth";
import { errorResponse } from "@/server/api-helpers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Stitch currently selected scene clips into a VoiceTake. */
export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    authorize(req);
    const { id } = await ctx.params;
    const take = await assembleVoiceTake(id);
    return NextResponse.json({ take }, { status: 201 });
  } catch (e) {
    return errorResponse(e);
  }
}
