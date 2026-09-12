import { z } from "zod";

import { updateCaptionCue } from "@/library/repositories/captions";
import { errorResponse } from "@/server/api-helpers";
import { authorize } from "@/server/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const patchSchema = z
  .object({
    text: z.string().trim().min(1).max(2_000).optional(),
    startFrame: z.number().int().nonnegative().optional(),
    endFrame: z.number().int().positive().optional(),
  })
  .refine((value) => Object.keys(value).length > 0);

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string; cueId: string }> },
) {
  try {
    authorize(req);
    const { id: scriptId, cueId } = await ctx.params;
    const track = await updateCaptionCue(
      scriptId,
      cueId,
      patchSchema.parse(await req.json()),
    );
    return Response.json({ track });
  } catch (error) {
    return errorResponse(error);
  }
}
