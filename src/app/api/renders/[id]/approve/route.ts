import { NextResponse } from "next/server";

import { approveRender, getRender } from "@/library/repositories/renders";
import { startRender } from "@/library/render-service";
import { requireWeb } from "@/server/auth";
import { errorResponse } from "@/server/api-helpers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/renders/[id]/approve — the single human gate for MCP-requested
 * renders. Same-origin only (an agent cannot approve its own render). Transitions
 * the render from pending_approval to queued and starts the job.
 */
export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    requireWeb(req);
    const { id } = await ctx.params;

    const render = await approveRender(id);
    if (!render) {
      // Not pending (already approved/started, or unknown id): report current state.
      const current = await getRender(id);
      if (!current) {
        return NextResponse.json({ error: "Render not found" }, { status: 404 });
      }
      return NextResponse.json({ render: current });
    }

    const serverBaseUrl = new URL(req.url).origin;
    startRender({
      renderId: render.id,
      scriptId: render.scriptId,
      voiceTakeId: render.voiceTakeId ?? undefined,
      quality: render.quality,
      serverBaseUrl,
    });

    return NextResponse.json({ render });
  } catch (e) {
    return errorResponse(e);
  }
}
