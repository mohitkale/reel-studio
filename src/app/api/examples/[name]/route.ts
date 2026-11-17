import { NextResponse } from "next/server";

import { readExample } from "@/library/examples";
import { authorizeRead } from "@/server/auth";
import { errorResponse } from "@/server/api-helpers";
import { ProviderError } from "@/providers/voice/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/examples/:name: one example as a Storyboard v1 document to remix. */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ name: string }> },
) {
  try {
    authorizeRead(req);
    const { name } = await params;
    const storyboard = readExample(name);
    if (!storyboard) throw new ProviderError("Example not found", 404);
    return NextResponse.json({ storyboard });
  } catch (error) {
    return errorResponse(error);
  }
}
