import { NextResponse } from "next/server";
import { z } from "zod";

import { getRender, deleteRender, renameRender } from "@/library/repositories/renders";
import { authorize } from "@/server/auth";
import { ProviderError } from "@/providers/voice/types";
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

const patchSchema = z.object({ name: z.string().max(120) });

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    authorize(req);
    const { id } = await ctx.params;
    const { name } = patchSchema.parse(await req.json());
    const render = await renameRender(id, name);
    return NextResponse.json({ render });
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
    await deleteRender(id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return errorResponse(e);
  }
}
