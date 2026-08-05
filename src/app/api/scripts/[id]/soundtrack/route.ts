import { NextResponse } from "next/server";
import { z } from "zod";

import { autoAttachBundledMusic } from "@/library/soundtrack-service";
import { getScript } from "@/library/repositories/scripts";
import { authorize } from "@/server/auth";
import { errorResponse } from "@/server/api-helpers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bodySchema = z.object({
  /** Replace existing musicUrl when true (Regenerate). Default: fill only if empty. */
  force: z.boolean().optional(),
});

/** POST /api/scripts/[id]/soundtrack — auto-attach bundled BGM from scene moods. */
export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    authorize(req);
    const { id } = await ctx.params;
    const body = bodySchema.parse(await req.json().catch(() => ({})));
    const result = await autoAttachBundledMusic(id, { force: body.force });
    if (!result.attached && result.reason === "not_found") {
      return NextResponse.json({ error: "Script not found" }, { status: 404 });
    }
    const script = await getScript(id);
    return NextResponse.json({ result, script });
  } catch (e) {
    return errorResponse(e);
  }
}
