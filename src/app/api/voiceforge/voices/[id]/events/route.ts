import { ProviderError } from "@/providers/voice/types";
import { errorResponse } from "@/server/api-helpers";
import { authorize } from "@/server/auth";
import {
  voiceforgeFetch,
  isVoiceforgeConfigured,
  voiceforgeAuthHeaders,
  voiceforgeBaseUrl,
} from "@/server/voiceforge-client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/voiceforge/voices/:id/events — SSE proxy for clone/training progress. */
export async function GET(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    authorize(req);
    if (!isVoiceforgeConfigured()) {
      throw new ProviderError(
        "VoiceForge is not configured. Set VOICEFORGE_SERVICE_URL in .env.local.",
        400,
        "voiceforge",
      );
    }

    const { id } = await ctx.params;
    const upstream = await voiceforgeFetch(
      `${voiceforgeBaseUrl()}/v1/voices/${encodeURIComponent(id)}/events`,
      {
        headers: {
          ...voiceforgeAuthHeaders(),
          Accept: "text/event-stream",
        },
        cache: "no-store",
        signal: req.signal,
      },
      20 * 60_000,
    );

    if (!upstream.ok || !upstream.body) {
      const body = await upstream.text().catch(() => "");
      throw new ProviderError(
        `VoiceForge events stream failed (HTTP ${upstream.status})${body ? `: ${body.slice(0, 200)}` : ""}`,
        upstream.status,
        "voiceforge",
      );
    }

    return new Response(upstream.body, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (e) {
    return errorResponse(e);
  }
}
