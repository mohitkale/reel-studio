import { NextResponse } from "next/server";
import { z } from "zod";

import {
  deleteTurn,
  insertTurn,
  replaceTurnsFromPlan,
  updateTurnText,
} from "@/library/repositories/podcasts";
import { podcastPlanSchema } from "@/library/podcast-schemas";
import { authorize } from "@/server/auth";
import { ProviderError } from "@/providers/voice/types";
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

const insertTurnSchema = z.object({
  characterId: z.string().min(1),
  text: z.string().trim().min(1).max(4000),
  afterTurnId: z.string().min(1).nullable().optional(),
});

/** POST /api/podcasts/:id/turns — insert one turn, or import a full script plan. */
export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    authorize(req);
    const { id } = await ctx.params;
    const body: unknown = await req.json();

    // Prefer full-plan import when `plan` is present so validation errors are useful.
    if (
      body &&
      typeof body === "object" &&
      "plan" in body &&
      (body as { plan?: unknown }).plan != null
    ) {
      const parsed = importSchema.parse(body);
      const podcast = await replaceTurnsFromPlan(id, parsed.plan, {
        updateMeta: parsed.updateMeta ?? false,
      });
      return NextResponse.json({ podcast });
    }

    const parsed = insertTurnSchema.parse(body);
    const podcast = await insertTurn(id, parsed);
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
    if (authorize(req) === "mcp") {
      throw new ProviderError("Deletion is not available via MCP", 403);
    }
    await ctx.params;
    const body = deleteSchema.parse(await req.json());
    const podcast = await deleteTurn(body.turnId);
    return NextResponse.json({ podcast });
  } catch (e) {
    return errorResponse(e);
  }
}
