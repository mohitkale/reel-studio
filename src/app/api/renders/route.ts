import { NextResponse } from "next/server";
import { z } from "zod";

import { createRender, listRenders } from "@/library/repositories/renders";
import { startRender } from "@/library/render-service";
import { errorResponse } from "@/server/api-helpers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const scriptId = searchParams.get("scriptId") ?? undefined;
    return NextResponse.json({ renders: await listRenders(scriptId) });
  } catch (e) {
    return errorResponse(e);
  }
}

const createSchema = z.object({
  scriptId: z.string().min(1),
  voiceTakeId: z.string().optional(),
});

export async function POST(req: Request) {
  try {
    const body = createSchema.parse(await req.json());
    const render = await createRender(body);
    // Fire off the render in the background; the response returns immediately.
    startRender({ renderId: render.id, ...body });
    return NextResponse.json({ render }, { status: 201 });
  } catch (e) {
    return errorResponse(e);
  }
}
