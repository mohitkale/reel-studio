import { NextResponse } from "next/server";
import { authorize, authorizeProviderRequest } from "@/server/auth";
import { errorResponse } from "@/server/api-helpers";
import { chapterGenerationRequestSchema } from "@/library/chapter-draft-input";
import { generateDraftChapter } from "@/library/chapter-generation-service";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;
export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    authorize(req);
    const parsed = chapterGenerationRequestSchema.safeParse(
      await req.json().catch(() => null),
    );
    if (!parsed.success)
      return NextResponse.json(
        {
          error: "Invalid chapter generation request",
          issues: parsed.error.issues,
        },
        { status: 400 },
      );
    const { id } = await ctx.params;
    const script = await generateDraftChapter(
      id,
      parsed.data,
      () => authorizeProviderRequest(req, [parsed.data.providerId]),
      req.signal,
    );
    return NextResponse.json({ script, draft: script.chapterDraft });
  } catch (error) {
    return errorResponse(error);
  }
}
