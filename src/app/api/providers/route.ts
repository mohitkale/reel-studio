import { NextResponse } from "next/server";

import { listProviderStatuses } from "@/providers/voice/registry";
import { getConfig } from "@/server/app-config";
import { errorResponse } from "@/server/api-helpers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/providers - status of every provider plus default selections. */
export async function GET() {
  try {
    const providers = listProviderStatuses();
    const config = await getConfig();
    return NextResponse.json({ providers, config });
  } catch (e) {
    return errorResponse(e);
  }
}
