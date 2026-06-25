import { NextResponse } from "next/server";

import { deleteAsset } from "@/library/repositories/assets";
import { requireWeb } from "@/server/auth";
import { errorResponse } from "@/server/api-helpers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function DELETE(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    requireWeb(req);
    const { id } = await ctx.params;
    await deleteAsset(id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return errorResponse(e);
  }
}
