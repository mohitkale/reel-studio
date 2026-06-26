import { NextResponse } from "next/server";
import { z } from "zod";

import { createRender, listRenders } from "@/library/repositories/renders";
import { startRender } from "@/library/render-service";
import { ORIENTATION_LABELS, orientationSchema } from "@/lib/orientation";
import { authorize } from "@/server/auth";
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
  /** Repurpose the script into another format; omit to use its native orientation. */
  orientation: orientationSchema.optional(),
});

export async function POST(req: Request) {
  try {
    const origin = authorize(req);
    const body = createSchema.parse(await req.json());

    // Label repurposed renders by their target format so the list is readable.
    const name = body.orientation
      ? ORIENTATION_LABELS[body.orientation]
      : undefined;

    // MCP-originated renders are compute-heavy and must be verified by a human:
    // create them as pending_approval and do NOT start the job. A same-origin
    // web click on the Renders page approves and starts it.
    if (origin === "mcp") {
      const render = await createRender({
        scriptId: body.scriptId,
        voiceTakeId: body.voiceTakeId,
        status: "pending_approval",
      });
      return NextResponse.json({ render }, { status: 201 });
    }

    const render = await createRender({ ...body, name });
    const serverBaseUrl = new URL(req.url).origin;
    startRender({ renderId: render.id, ...body, serverBaseUrl });
    return NextResponse.json({ render }, { status: 201 });
  } catch (e) {
    return errorResponse(e);
  }
}
