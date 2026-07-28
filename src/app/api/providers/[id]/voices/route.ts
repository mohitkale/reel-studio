import { type NextRequest, NextResponse } from "next/server";

import { getProvider, isProviderId } from "@/providers/voice/registry";
import { filterKokoroVoices } from "@/providers/voice/kokoro";
import { getConfig } from "@/server/app-config";
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
      const hint =
        id === "voiceforge"
          ? `${provider.label} is not configured. Set VOICEFORGE_SERVICE_URL in .env.local.`
          : `${provider.label} has no API key. Add one in Settings.`;
      throw new ProviderError(hint, 400, id);
    }

    const q = req.nextUrl.searchParams.get("q")?.trim() || undefined;
    // Settings UI can request the unfiltered Kokoro catalog with ?all=1.
    const showAll = req.nextUrl.searchParams.get("all") === "1";

    if (id === "kokoro" || id === "kokoro-server") {
      const config = showAll ? null : await getConfig();
      const voices = filterKokoroVoices({
        query: q,
        visibleIds: showAll ? null : config?.kokoroVisibleVoiceIds,
      });
      return NextResponse.json({ voices });
    }

    const voices = await provider.listVoices(q);
    return NextResponse.json({ voices });
  } catch (e) {
    return errorResponse(e);
  }
}
