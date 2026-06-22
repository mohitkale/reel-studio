import { NextResponse } from "next/server";
import { z } from "zod";

import { getScript, renameScript } from "@/library/repositories/scripts";
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

const patchSchema = z.object({ name: z.string().trim().min(1).max(120) });

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await ctx.params;
    const { name } = patchSchema.parse(await req.json());
    await renameScript(id, name);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return errorResponse(e);
  }
}
