import { NextResponse } from "next/server";
import { z } from "zod";

import {
  getBrandKit,
  updateBrandKit,
  setDefaultBrandKit,
  deleteBrandKit,
} from "@/library/repositories/brandkits";
import { requireWeb } from "@/server/auth";
import { errorResponse } from "@/server/api-helpers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const colorRecord = z.record(z.string().regex(/^#[0-9a-fA-F]{6}$/));

const patchSchema = z.object({
  name: z.string().min(1).max(80).optional(),
  handle: z.string().max(64).nullable().optional(),
  palette: colorRecord.optional(),
  fonts: z.object({ fontFamily: z.string().max(120).optional() }).optional(),
  isDefault: z.boolean().optional(),
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
    requireWeb(req);
    const { id } = await ctx.params;
    const body = patchSchema.parse(await req.json());
    const { isDefault, ...kitPatch } = body;

    if (isDefault !== undefined) {
      await setDefaultBrandKit(isDefault ? id : null);
    }

    if (Object.keys(kitPatch).length > 0) {
      const kit = await updateBrandKit(id, kitPatch);
      return NextResponse.json(kit);
    }

    const kit = await getBrandKit(id);
    if (!kit) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json(kit);
  } catch (e) {
    return errorResponse(e);
  }
}

export async function DELETE(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    requireWeb(req);
    const { id } = await ctx.params;
    await deleteBrandKit(id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return errorResponse(e);
  }
}
