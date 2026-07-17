import { NextResponse } from "next/server";
import { z } from "zod";

import { getScript, updateScript } from "@/library/repositories/scripts";
import { authorize } from "@/server/auth";
import { errorResponse } from "@/server/api-helpers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await ctx.params;
    const script = await getScript(id);
    if (!script) {
      return NextResponse.json({ error: "Script not found" }, { status: 404 });
    }
    return NextResponse.json({ script });
  } catch (e) {
    return errorResponse(e);
  }
}

const patchSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  coverUrl: z.string().max(2048).nullable().optional(),
  musicUrl: z.string().max(2048).nullable().optional(),
  musicVolume: z.number().int().min(0).max(100).optional(),
  hideText: z.boolean().optional(),
  hideProgressBar: z.boolean().optional(),
  styleId: z.enum(["bold-hook", "clean-story", "teach-me", "soft-brand"]).optional(),
  energy: z.enum(["calm", "normal", "high"]).optional(),
});

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    authorize(req);
    const { id } = await ctx.params;
    const body = patchSchema.parse(await req.json());
    await updateScript(id, body);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return errorResponse(e);
  }
}
