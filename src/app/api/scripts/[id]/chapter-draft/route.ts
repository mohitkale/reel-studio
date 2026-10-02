import { NextResponse } from "next/server";
import { authorize, authorizeProviderRequest } from "@/server/auth";
import { errorResponse, readRequestJson } from "@/server/api-helpers";
import { chapterDraftRequestSchema } from "@/library/chapter-draft-input";
import { chapterDraftEditSchema } from "@/production/chapter-draft";
import {
  generateChapterDraft,
  saveChapterDraft,
} from "@/library/chapter-draft-service";
import { getScript } from "@/library/repositories/scripts";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;
type Context = { params: Promise<{ id: string }> };
export async function POST(req: Request, ctx: Context) {
  try {
    authorize(req);
    const body = chapterDraftRequestSchema.safeParse(
      await readRequestJson(req),
    );
    if (!body.success)
      return NextResponse.json(
        { error: "Invalid topic chapter request", issues: body.error.issues },
        { status: 400 },
      );
    const { id } = await ctx.params;
    const draft = await generateChapterDraft(
      id,
      body.data,
      () => authorizeProviderRequest(req, [body.data.providerId]),
      req.signal,
    );
    return NextResponse.json({ draft, script: await getScript(id) });
  } catch (error) {
    return errorResponse(error);
  }
}
export async function PATCH(req: Request, ctx: Context) {
  try {
    authorize(req);
    const body = chapterDraftEditSchema.safeParse(await readRequestJson(req));
    if (!body.success)
      return NextResponse.json(
        { error: "Invalid chapter draft edit", issues: body.error.issues },
        { status: 400 },
      );
    const { id } = await ctx.params;
    const draft = await saveChapterDraft(id, body.data);
    return NextResponse.json({ draft, script: await getScript(id) });
  } catch (error) {
    return errorResponse(error);
  }
}
