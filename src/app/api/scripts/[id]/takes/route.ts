import { NextResponse } from "next/server";
import { z } from "zod";

import { listTakes } from "@/library/repositories/takes";
import { generateTake } from "@/library/take-service";
import { PROVIDER_IDS } from "@/providers/voice/types";
import { authorize } from "@/server/auth";
import { errorResponse } from "@/server/api-helpers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await ctx.params;
    return NextResponse.json({ takes: await listTakes(id) });
  } catch (e) {
    return errorResponse(e);
  }
}

const generateSchema = z
  .object({
    placeholder: z.boolean().optional(),
    providerId: z.enum(PROVIDER_IDS).optional(),
    voiceId: z.string().optional(),
    modelId: z.string().optional(),
    label: z.string().max(120).optional(),
  })
  .default({});

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    authorize(req);
    const { id } = await ctx.params;
    const body = generateSchema.parse(await req.json().catch(() => ({})));
    const take = await generateTake({ scriptId: id, ...body });
    return NextResponse.json({ take }, { status: 201 });
  } catch (e) {
    return errorResponse(e);
  }
}
