import { NextResponse } from "next/server";

import { authorize, authorizeRead } from "@/server/auth";
import { errorResponse } from "@/server/api-helpers";
import {
  deleteRecording,
  getRecording,
  suggestRecordingClips,
} from "@/library/recording-repurpose";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/recordings/:id: status, the word-timed transcript and the suggested clips. */
export async function GET(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    authorizeRead(req);
    const { id } = await ctx.params;
    const recording = await getRecording(id);
    return NextResponse.json({
      recording,
      suggestions:
        recording.status === "ready" ? await suggestRecordingClips(id) : [],
    });
  } catch (error) {
    return errorResponse(error);
  }
}

/** DELETE /api/recordings/:id: remove the recording and its transcript. Finished clips stay in Assets. */
export async function DELETE(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    authorize(req);
    await deleteRecording((await ctx.params).id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return errorResponse(error);
  }
}
