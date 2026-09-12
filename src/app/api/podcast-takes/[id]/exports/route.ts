import { NextResponse } from "next/server";
import { z } from "zod";

import { preparePodcastTakeExport } from "@/library/podcast-export-service";
import { authorize } from "@/server/auth";
import { errorResponse } from "@/server/api-helpers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const exportSchema = z.object({ format: z.enum(["wav", "mp3"]) });

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    authorize(req);
    const { id } = await ctx.params;
    const { format } = exportSchema.parse(await req.json());
    return NextResponse.json(await preparePodcastTakeExport(id, format));
  } catch (error) {
    return errorResponse(error);
  }
}
