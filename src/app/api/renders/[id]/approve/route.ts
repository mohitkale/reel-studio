import { NextResponse } from "next/server";

import { getRender } from "@/library/repositories/renders";
import { approveEditorRender } from "@/library/editor-render-jobs";
import { requireWeb } from "@/server/auth";
import { errorResponse } from "@/server/api-helpers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/renders/[id]/approve — the single human gate for MCP-requested
 * renders. Web-only (bearer automation cannot approve its own render; default
 * loopback requests still trust local processes). Transitions
 * the render from pending_approval to queued and starts the job.
 */
export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    requireWeb(req);
    const { id } = await ctx.params;

    await approveEditorRender(id, new URL(req.url).origin);
    const render = await getRender(id);
    if (!render)
      return NextResponse.json({ error: "Render not found" }, { status: 404 });

    return NextResponse.json({ render });
  } catch (e) {
    return errorResponse(e);
  }
}
