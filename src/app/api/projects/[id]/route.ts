import { NextResponse } from "next/server";
import { z } from "zod";

import { deleteProject, assignBrandKit } from "@/library/repositories/projects";
import { authorize } from "@/server/auth";
import { ProviderError } from "@/providers/voice/types";
import { errorResponse } from "@/server/api-helpers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const patchSchema = z.object({
  brandKitId: z.string().nullable().optional(),
});

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    authorize(req);
    const { id } = await ctx.params;
    const body = patchSchema.parse(await req.json());
    if (body.brandKitId !== undefined) {
      await assignBrandKit(id, body.brandKitId);
    }
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
    await deleteProject(id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return errorResponse(e);
  }
}
