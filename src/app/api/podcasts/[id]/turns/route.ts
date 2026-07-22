import { NextResponse } from "next/server";
import { z } from "zod";

import {
  deleteTurn,
  replaceTurnsFromPlan,
  updateTurnText,
} from "@/library/repositories/podcasts";
import { podcastPlanSchema } from "@/library/podcast-schemas";
import { authorize } from "@/server/auth";
import { errorResponse } from "@/server/api-helpers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const importSchema = z.object({
  plan: podcastPlanSchema,
  updateMeta: z.boolean().optional(),
});

const patchTurnSchema = z.object({
  turnId: z.string().min(1),
  text: z.string().trim().min(1).max(4000),
});

/** POST /api/podcasts/:id/turns — import a full script plan (JSON paste). */
export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    authorize(req);
    const { id } = await ctx.params;
    const body = importSchema.parse(await req.json());
    const podcast = await replaceTurnsFromPlan(id, body.plan, {
      updateMeta: body.updateMeta ?? false,
    });
    return NextResponse.json({ podcast });
  } catch (e) {
    return errorResponse(e);
  }
}

/** PATCH /api/podcasts/:id/turns — update one turn's text. */
export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    authorize(req);
    await ctx.params;
    const body = patchTurnSchema.parse(await req.json());
    const podcast = await updateTurnText(body.turnId, body.text);
    return NextResponse.json({ podcast });
  } catch (e) {
    return errorResponse(e);
  }
}

const deleteSchema = z.object({
  turnId: z.string().min(1),
});

/** DELETE /api/podcasts/:id/turns — delete one turn (body: { turnId }). */
export async function DELETE(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    authorize(req);
    await ctx.params;
    const body = deleteSchema.parse(await req.json());
    const podcast = await deleteTurn(body.turnId);
    return NextResponse.json({ podcast });
  } catch (e) {
    return errorResponse(e);
  }
}
