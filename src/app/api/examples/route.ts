import { NextResponse } from "next/server";

import { listExamples } from "@/library/examples";
import { authorizeRead } from "@/server/auth";
import { errorResponse } from "@/server/api-helpers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/examples: the golden storyboards with their look, scene types and length. */
export async function GET(req: Request) {
  try {
    authorizeRead(req);
    return NextResponse.json({ examples: listExamples() });
  } catch (error) {
    return errorResponse(error);
  }
}
