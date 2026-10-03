import { NextResponse } from "next/server";
import { createVisualReview } from "@/library/visual-review";
import { getScript } from "@/library/repositories/scripts";
import { currentVideoRevisionHash } from "@/library/production-revision";
import { ProviderError } from "@/providers/voice/types";
import { reviewAndRepairDirection } from "@/library/director-review";
import { visualReviewRequestSchema } from "@/production/visual-review";
import { authorize } from "@/server/auth";
import { errorResponse, readRequestJson } from "@/server/api-helpers";

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
      await readRequestJson(req),
    );
    if (!body.success)
      return NextResponse.json(
        { error: "Invalid visual review request", issues: body.error.issues },
        { status: 400 },
      );
    const { id } = await ctx.params;
    const review = await (
      body.data.repairPasses ? reviewAndRepairDirection : createVisualReview
    )(id, body.data, new URL(req.url).origin, req.signal);
    const script = review.repair?.repairedSceneIds.length
      ? await getScript(id)
      : undefined;
    if (
      script &&
      (await currentVideoRevisionHash(id, body.data.voiceTakeId)) !==
        review.repair?.sourceRevision
    )
      throw new ProviderError(
        "The video changed after repair. Review its current revision.",
        409,
      );
    return NextResponse.json({ review, ...(script ? { script } : {}) });
  } catch (error) {
    return errorResponse(error);
  }
}
