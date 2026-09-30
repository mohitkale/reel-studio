import { NextResponse } from "next/server";
import { z } from "zod";
import { authorize } from "@/server/auth";
import { errorResponse } from "@/server/api-helpers";
import {
  proposeScriptChapters,
  saveChapterPlan,
} from "@/library/chapter-service";
import { getScript } from "@/library/repositories/scripts";
import { chapterEditSchema } from "@/production/chapters";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type Context = { params: Promise<{ id: string }> };
export async function POST(req: Request, ctx: Context) {
  try {
    authorize(req);
    const body = z
      .object({ takeId: z.string().min(1).optional() })
      .strict()
      .safeParse(await req.json().catch(() => null));
    if (!body.success)
      return NextResponse.json(
        { error: "Invalid chapter proposal request" },
        { status: 400 },
      );
    const { id } = await ctx.params;
    return NextResponse.json(await proposeScriptChapters(id, body.data.takeId));
  } catch (error) {
    return errorResponse(error);
  }
}
export async function PATCH(req: Request, ctx: Context) {
  try {
    authorize(req);
    const body = chapterEditSchema.safeParse(
      await req.json().catch(() => null),
    );
    if (!body.success)
      return NextResponse.json(
        { error: "Invalid chapter edit", issues: body.error.issues },
        { status: 400 },
      );
    const { id } = await ctx.params;
    const plan = await saveChapterPlan(id, body.data);
    return NextResponse.json({ plan, script: await getScript(id) });
  } catch (error) {
    return errorResponse(error);
  }
}
