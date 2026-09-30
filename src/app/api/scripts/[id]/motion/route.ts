import { NextResponse } from "next/server";
import { z } from "zod";

import { replanMotionDirection } from "@/library/motion-direction-service";
import { getScript } from "@/library/repositories/scripts";
import { visualAmbitionSchema } from "@/production/motion-plan";
import { authorize } from "@/server/auth";
import { errorResponse } from "@/server/api-helpers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const bodySchema = z
  .object({
    ambition: visualAmbitionSchema.optional(),
    chapterMotifs: z.boolean().optional(),
    newVariation: z.boolean().default(false),
  })
  .strict();

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    authorize(req);
    const body = bodySchema.safeParse(await req.json().catch(() => null));
    if (!body.success)
      return NextResponse.json(
        {
          error: "Invalid motion direction request",
          issues: body.error.issues,
        },
        { status: 400 },
      );
    const { id } = await ctx.params;
    const result = await replanMotionDirection(id, body.data);
    if (result.state === "not_found")
      return NextResponse.json({ error: "Script not found" }, { status: 404 });
    if (result.state === "legacy")
      return NextResponse.json(
        { error: "Motion direction requires a production preset" },
        { status: 409 },
      );
    return NextResponse.json({ result, script: await getScript(id) });
  } catch (e) {
    return errorResponse(e);
  }
}
