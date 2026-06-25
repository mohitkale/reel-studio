import { NextResponse } from "next/server";
import { z } from "zod";

import { deleteTake, renameTake } from "@/library/repositories/takes";
import { authorize } from "@/server/auth";
import { ProviderError } from "@/providers/voice/types";
import { errorResponse } from "@/server/api-helpers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const patchSchema = z.object({ label: z.string().trim().min(1).max(120) });

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    authorize(req);
    const { id } = await ctx.params;
    const { label } = patchSchema.parse(await req.json());
    await renameTake(id, label);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return errorResponse(e);
  }
}

export async function DELETE(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    if (authorize(req) === "mcp") {
      throw new ProviderError("Deletion is not available via MCP", 403);
    }
    const { id } = await ctx.params;
    await deleteTake(id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return errorResponse(e);
  }
}
