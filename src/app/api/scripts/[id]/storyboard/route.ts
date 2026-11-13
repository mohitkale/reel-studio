import { NextResponse } from "next/server";

import { authorizeRead } from "@/server/auth";
import { errorResponse } from "@/server/api-helpers";
import { projectToStoryboard } from "@/library/project-storyboard";
import { ProviderError } from "@/providers/voice/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/scripts/:id/storyboard: the project as a Storyboard v1 document.
 * `?download=1` sends it as a file. Anything the scene model cannot carry is
 * listed in `notes` (or the `X-Storyboard-Notes` header for downloads).
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    authorizeRead(req);
    const { id } = await params;
    const result = await projectToStoryboard(id);
    if (!result) throw new ProviderError("Script not found", 404);
    if (!result.storyboard) {
      return NextResponse.json(
        { ok: false, errors: result.errors, notes: result.notes },
        { status: 422 },
      );
    }
    if (new URL(req.url).searchParams.get("download")) {
      const name =
        result.storyboard.title
          .replace(/[^a-z0-9]+/gi, "-")
          .replace(/^-|-$/g, "")
          .toLowerCase() || "storyboard";
      return new Response(`${JSON.stringify(result.storyboard, null, 2)}\n`, {
        headers: {
          "content-type": "application/json; charset=utf-8",
          "content-disposition": `attachment; filename="${name}.storyboard.json"`,
          "x-storyboard-notes": String(result.notes.length),
        },
      });
    }
    return NextResponse.json({
      ok: true,
      storyboard: result.storyboard,
      notes: result.notes,
    });
  } catch (error) {
    return errorResponse(error);
  }
}
