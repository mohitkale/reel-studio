import { NextResponse } from "next/server";

import { ProviderError } from "@/providers/voice/types";
import { errorResponse } from "@/server/api-helpers";
import { authorize } from "@/server/auth";
import {
  isVoiceforgeConfigured,
  voiceforgeAuthHeaders,
  voiceforgeBaseUrl,
} from "@/server/voiceforge-client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/voiceforge/voices/:id/preview — proxy cached preview audio. */
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
    const res = await fetch(
      `${voiceforgeBaseUrl()}/v1/voices/${encodeURIComponent(id)}/preview`,
      {
        headers: voiceforgeAuthHeaders(),
        cache: "no-store",
      },
    );

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new ProviderError(
        `VoiceForge preview failed (HTTP ${res.status})${body ? `: ${body.slice(0, 200)}` : ""}`,
        res.status,
        "voiceforge",
      );
    }

    const bytes = await res.arrayBuffer();
    return new NextResponse(bytes, {
      headers: {
        "Content-Type": res.headers.get("content-type") ?? "audio/wav",
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch (e) {
    return errorResponse(e);
  }
}
