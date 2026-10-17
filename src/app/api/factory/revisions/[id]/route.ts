import { NextResponse } from "next/server";
import { authorizeRequest } from "@/server/auth";
import { errorResponse } from "@/server/api-helpers";
import { prisma } from "@/library/db";
import { videoSnapshotSchema } from "@/production/video-snapshot";
import { frozenRevisionMatches } from "@/library/frozen-revision";
export const runtime = "nodejs";
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    authorizeRequest(req, "studio:read");
    const row = await prisma.productionRevision.findUnique({
      where: { id: (await params).id },
    });
    if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const snapshot = videoSnapshotSchema.parse(JSON.parse(row.snapshotJson));
    if (!frozenRevisionMatches(row, snapshot))
      throw new Error("Revision integrity check failed");
    return NextResponse.json({
      revisionId: row.id,
      revisionHash: row.revisionHash,
      document: { kind: "reel-studio-film-plan", version: 1, snapshot },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
