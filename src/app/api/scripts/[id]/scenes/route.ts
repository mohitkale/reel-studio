import { NextResponse } from "next/server";
import { z } from "zod";

import { addScene, reorderScenes } from "@/library/repositories/scenes";
import { authorize } from "@/server/auth";
import { errorResponse } from "@/server/api-helpers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const addSchema = z.object({
  text: z.string().max(2000).default(""),
  templateId: z.string().optional(),
});

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    authorize(req);
    const { id } = await ctx.params;
    const body = addSchema.parse(await req.json().catch(() => ({})));
    return NextResponse.json(
      { scene: await addScene(id, body) },
      { status: 201 },
    );
  } catch (e) {
    return errorResponse(e);
  }
}

const reorderSchema = z.object({ orderedIds: z.array(z.string()).min(1) });

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    authorize(req);
    const { id } = await ctx.params;
    const { orderedIds } = reorderSchema.parse(await req.json());
    await reorderScenes(id, orderedIds);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return errorResponse(e);
  }
}
