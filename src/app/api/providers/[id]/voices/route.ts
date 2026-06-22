import { type NextRequest, NextResponse } from "next/server";

import { getProvider, isProviderId } from "@/providers/voice/registry";
import { errorResponse } from "@/server/api-helpers";
import { ProviderError } from "@/providers/voice/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/providers/:id/voices?q= - merged default + cloned voices. */
export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await ctx.params;
    if (!isProviderId(id)) throw new ProviderError(`Unknown provider "${id}"`, 404);

    const provider = getProvider(id);
    if (!provider.isConfigured()) {
      throw new ProviderError(
        `${provider.label} has no API key. Add one in Settings.`,
        400,
        id,
      );
    }

    const q = req.nextUrl.searchParams.get("q")?.trim() || undefined;
    const voices = await provider.listVoices(q);
    return NextResponse.json({ voices });
  } catch (e) {
    return errorResponse(e);
  }
}
