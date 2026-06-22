import { NextResponse } from "next/server";

import { listAIProviderStatuses } from "@/providers/ai/registry";
import { errorResponse } from "@/server/api-helpers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/ai/providers - status of every AI director provider. */
export async function GET() {
  try {
    return NextResponse.json({ providers: listAIProviderStatuses() });
  } catch (e) {
    return errorResponse(e);
  }
}
