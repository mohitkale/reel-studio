import { NextResponse } from "next/server";

import { getRender, deleteRender } from "@/library/repositories/renders";
import { errorResponse } from "@/server/api-helpers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await ctx.params;
    const render = await getRender(id);
    if (!render) {
      return NextResponse.json({ error: "Render not found" }, { status: 404 });
    }
    return NextResponse.json({ render });
  } catch (e) {
    return errorResponse(e);
  }
}

export async function DELETE(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await ctx.params;
    await deleteRender(id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return errorResponse(e);
  }
}
