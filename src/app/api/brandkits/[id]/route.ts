import { NextResponse } from "next/server";
import { z } from "zod";

import {
  getBrandKit,
  updateBrandKit,
  deleteBrandKit,
} from "@/library/repositories/brandkits";
import { errorResponse } from "@/server/api-helpers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const colorRecord = z.record(z.string().regex(/^#[0-9a-fA-F]{6}$/));

const patchSchema = z.object({
  name: z.string().min(1).max(80).optional(),
  handle: z.string().max(64).nullable().optional(),
  palette: colorRecord.optional(),
  fonts: z.object({ fontFamily: z.string().max(120).optional() }).optional(),
});

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await ctx.params;
    const kit = await getBrandKit(id);
    if (!kit) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json(kit);
  } catch (e) {
    return errorResponse(e);
  }
}

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await ctx.params;
    const body = patchSchema.parse(await req.json());
    const kit = await updateBrandKit(id, body);
    return NextResponse.json(kit);
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
    await deleteBrandKit(id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return errorResponse(e);
  }
}
