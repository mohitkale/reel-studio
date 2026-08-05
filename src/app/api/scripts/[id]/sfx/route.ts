import { NextResponse } from "next/server";
import { z } from "zod";

import { ensureSfxCues, setSfxEnabled } from "@/library/sfx-service";
import { getScript } from "@/library/repositories/scripts";
import { authorize } from "@/server/auth";
import { errorResponse } from "@/server/api-helpers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bodySchema = z.object({
  force: z.boolean().optional(),
  enabled: z.boolean().optional(),
});

/** POST /api/scripts/[id]/sfx — ensure / regenerate template SFX cues, or toggle. */
export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    authorize(req);
    const { id } = await ctx.params;
    const body = bodySchema.parse(await req.json().catch(() => ({})));

    if (body.enabled === false) {
      await setSfxEnabled(id, false);
      const script = await getScript(id);
      return NextResponse.json({
        result: { attached: false, reason: "disabled" },
        script,
      });
    }

    if (body.enabled === true) {
      await setSfxEnabled(id, true);
    }

    const result = await ensureSfxCues(id, {
      force: body.force,
      enabled: body.enabled,
    });
    if (!result.attached && result.reason === "not_found") {
      return NextResponse.json({ error: "Script not found" }, { status: 404 });
    }
    const script = await getScript(id);
    return NextResponse.json({ result, script });
  } catch (e) {
    return errorResponse(e);
  }
}
