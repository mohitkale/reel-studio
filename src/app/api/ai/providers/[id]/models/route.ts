import { NextResponse } from "next/server";

import { getAIProvider, isAIProviderId } from "@/providers/ai/registry";
import { AIError } from "@/providers/ai/types";
import { errorResponse } from "@/server/api-helpers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/ai/providers/:id/models - LLM models available for this provider. */
export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await ctx.params;
    if (!isAIProviderId(id)) throw new AIError(`Unknown AI provider "${id}"`, 404);

    const provider = getAIProvider(id);
    if (!provider.isConfigured()) {
      throw new AIError(
        `${provider.label} has no API key. Add one in Settings.`,
        400,
        id,
      );
    }
    return NextResponse.json({ models: await provider.listModels() });
  } catch (e) {
    return errorResponse(e);
  }
}
