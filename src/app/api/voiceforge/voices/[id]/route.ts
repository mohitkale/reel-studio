import { NextResponse } from "next/server";
import { z } from "zod";

import { ProviderError } from "@/providers/voice/types";
import { errorResponse } from "@/server/api-helpers";
import {
  isVoiceforgeConfigured,
  voiceforgeAuthHeaders,
  voiceforgeBaseUrl,
} from "@/server/voiceforge-client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const voiceDetailSchema = z.object({
  id: z.string(),
  name: z.string(),
  engineId: z.string(),
  tier: z.enum(["instant", "high_fidelity"]),
  status: z.enum(["processing", "ready", "failed"]),
  language: z.string().optional(),
  errorMessage: z.string().nullish(),
  previewUrl: z.string().nullish(),
  sampleCount: z.number().optional(),
});

function assertConfigured() {
  if (!isVoiceforgeConfigured()) {
    throw new ProviderError(
      "VoiceForge is not configured. Set VOICEFORGE_SERVICE_URL in .env.local.",
      400,
      "voiceforge",
    );
  }
}

/** GET /api/voiceforge/voices/:id — poll voice processing status. */
export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    assertConfigured();
    const { id } = await ctx.params;
    const res = await fetch(
      `${voiceforgeBaseUrl()}/v1/voices/${encodeURIComponent(id)}`,
      {
        headers: { ...voiceforgeAuthHeaders(), Accept: "application/json" },
        cache: "no-store",
      },
    );
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new ProviderError(
        `VoiceForge voice lookup failed (HTTP ${res.status})${body ? `: ${body.slice(0, 200)}` : ""}`,
        res.status,
        "voiceforge",
      );
    }
    const voice = voiceDetailSchema.parse(await res.json());
    return NextResponse.json({ voice });
  } catch (e) {
    return errorResponse(e);
  }
}
