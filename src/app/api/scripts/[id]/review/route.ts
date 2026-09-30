import { NextResponse } from "next/server";
import { createVisualReview } from "@/library/visual-review";
import { visualReviewRequestSchema } from "@/production/visual-review";
import { authorize } from "@/server/auth";
import { errorResponse } from "@/server/api-helpers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    if (authorize(req) === "mcp")
      return NextResponse.json(
        { error: "Generate visual review in the editor." },
        { status: 403 },
      );
    const body = visualReviewRequestSchema.safeParse(
      await req.json().catch(() => null),
    );
    if (!body.success)
      return NextResponse.json(
        { error: "Invalid visual review request", issues: body.error.issues },
        { status: 400 },
      );
    const { id } = await ctx.params;
    return NextResponse.json({
      review: await createVisualReview(
        id,
        body.data,
        new URL(req.url).origin,
        req.signal,
      ),
    });
  } catch (error) {
    return errorResponse(error);
  }
}
