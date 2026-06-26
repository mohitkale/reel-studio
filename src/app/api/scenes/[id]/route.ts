import { NextResponse } from "next/server";
import { z } from "zod";

import { deleteScene, updateScene } from "@/library/repositories/scenes";
import { authorize } from "@/server/auth";
import { ProviderError } from "@/providers/voice/types";
import { errorResponse } from "@/server/api-helpers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const backgroundSchema = z.object({
  type: z.enum(["image", "video"]),
  url: z.string().min(1).max(2048),
  effect: z
    .enum(["ken-burns", "pan-left", "pan-right", "pan-up", "pan-down"])
    .optional(),
  muted: z.boolean().optional(),
});

const patchSchema = z.object({
  text: z.string().max(2000).optional(),
  templateId: z.string().optional(),
  emphasis: z.array(z.string()).optional(),
  // Short label/emoji hint for the template's visual slot.
  visual: z.string().max(2048).nullable().optional(),
  // Per-scene full-bleed background (image/video); null clears it.
  background: backgroundSchema.nullable().optional(),
  // List items for list/checklist templates; null/empty clears them.
  items: z.array(z.string().max(280)).max(24).nullable().optional(),
  // Per-scene text visibility override; null = inherit the script default.
  hideText: z.boolean().nullable().optional(),
});

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    authorize(req);
    const { id } = await ctx.params;
    const body = patchSchema.parse(await req.json());
    return NextResponse.json({ scene: await updateScene(id, body) });
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
    await deleteScene(id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return errorResponse(e);
  }
}
