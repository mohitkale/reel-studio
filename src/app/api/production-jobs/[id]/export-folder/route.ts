import { NextResponse } from "next/server";

import { authorizeRequest } from "@/server/auth";
import { errorResponse } from "@/server/api-helpers";
import { writeExportFolder } from "@/library/export-folder";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/production-jobs/:id/export-folder: write one folder for a finished
 * video (MP4, title, description, hashtags, storyboard, thumbnail) under
 * `media/exports/` and return its path. Safe to repeat.
 */
export async function POST(
  req: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    authorizeRequest(req, "artifacts:read");
    const { id } = await context.params;
    return NextResponse.json(await writeExportFolder(id));
  } catch (error) {
    return errorResponse(error);
  }
}
