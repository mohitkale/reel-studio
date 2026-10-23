import { NextResponse } from "next/server";
import { z } from "zod";
import { authorize, authorizeRead } from "@/server/auth";
import {
  errorResponse,
  parseClientInput,
  readRequestJson,
} from "@/server/api-helpers";
import { listSceneHistory, moveSceneHistory } from "@/library/scene-history";
export const runtime = "nodejs";
export async function GET(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    authorizeRead(req);
    return NextResponse.json({
      history: await listSceneHistory((await ctx.params).id),
    });
  } catch (e) {
    return errorResponse(e);
  }
}
export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    authorize(req);
    const { action } = parseClientInput(
      z.object({ action: z.enum(["undo", "redo"]) }),
      await readRequestJson(req),
    );
    return NextResponse.json({
      sceneId: await moveSceneHistory((await ctx.params).id, action),
    });
  } catch (e) {
    return errorResponse(e);
  }
}
