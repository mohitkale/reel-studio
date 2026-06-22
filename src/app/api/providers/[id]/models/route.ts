import { NextResponse } from "next/server";

import { getProvider, isProviderId } from "@/providers/voice/registry";
import { errorResponse } from "@/server/api-helpers";
import { ProviderError } from "@/providers/voice/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/providers/:id/models - TTS models for the provider. */
export async function GET(
  _req: Request,
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

    const models = await provider.listModels();
    return NextResponse.json({ models });
  } catch (e) {
    return errorResponse(e);
  }
}
