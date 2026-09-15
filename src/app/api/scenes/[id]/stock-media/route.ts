import { NextResponse } from "next/server";

import {
  clearSelectedSceneStockMedia,
  selectSceneStockMedia,
  selectSceneStockMediaSchema,
} from "@/library/stock-media-workflow";
import { getStockMediaSelection } from "@/library/repositories/stock-media-selections";
import { errorResponse } from "@/server/api-helpers";
import { authorize, requireWeb } from "@/server/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    authorize(req);
    const { id } = await ctx.params;
    return NextResponse.json({ selection: await getStockMediaSelection(id) });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    requireWeb(req);
    const { id } = await ctx.params;
    const input = selectSceneStockMediaSchema.parse(await req.json());
    return NextResponse.json(await selectSceneStockMedia(id, input));
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    requireWeb(req);
    const { id } = await ctx.params;
    return NextResponse.json(await clearSelectedSceneStockMedia(id));
  } catch (error) {
    return errorResponse(error);
  }
}
