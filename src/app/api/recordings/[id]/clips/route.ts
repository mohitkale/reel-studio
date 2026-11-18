import { NextResponse } from "next/server";

import { authorize, authorizeRead } from "@/server/auth";
import { errorResponse, readRequestJson } from "@/server/api-helpers";
import { getClipJob, startClips } from "@/library/recording-repurpose";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/recordings/:id/clips: progress and the finished clips of the latest run. */
export async function GET(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    authorizeRead(req);
    const job = getClipJob((await ctx.params).id);
    return NextResponse.json({ job: job ?? null });
  } catch (error) {
    return errorResponse(error);
  }
}

/**
 * POST /api/recordings/:id/clips: make captioned clips. Body: `clips` (word
 * ranges from the suggestions), `removed` (word indexes deleted in the
 * transcript), `trimSilence`, `removeFillers`, `format`, `reframe`, `theme`,
 * `quality`. Runs in the background; poll GET.
 */
export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    authorize(req);
    const job = await startClips(
      (await ctx.params).id,
      await readRequestJson(req),
    );
    return NextResponse.json({ job }, { status: 202 });
  } catch (error) {
    return errorResponse(error);
  }
}
