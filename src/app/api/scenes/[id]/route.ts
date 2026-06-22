import { NextResponse } from "next/server";
import { z } from "zod";

import { deleteScene, updateScene } from "@/library/repositories/scenes";
import { errorResponse } from "@/server/api-helpers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const patchSchema = z.object({
  text: z.string().max(2000).optional(),
  templateId: z.string().optional(),
  emphasis: z.array(z.string()).optional(),
  visual: z.string().max(64).nullable().optional(),
});

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await ctx.params;
    const body = patchSchema.parse(await req.json());
    return NextResponse.json({ scene: await updateScene(id, body) });
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
    await deleteScene(id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return errorResponse(e);
  }
}
