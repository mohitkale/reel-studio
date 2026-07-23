import { NextResponse } from "next/server";
import { z } from "zod";

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

const engineSchema = z.object({
  id: z.string(),
  label: z.string(),
  ready: z.boolean(),
  configured: z.boolean().optional(),
  capabilities: z
    .object({
      zero_shot: z.boolean(),
      fine_tunable: z.boolean(),
      min_sample_seconds: z.number(),
      recommended_sample_seconds: z.number(),
      requires_gpu: z.boolean(),
      license: z.string(),
    })
    .passthrough()
    .optional(),
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

/** GET /api/voiceforge/engines — proxy engine list for the clone UI. */
export async function GET(req: Request) {
  try {
    authorize(req);
    assertConfigured();
    const res = await fetch(`${voiceforgeBaseUrl()}/v1/engines`, {
      headers: { ...voiceforgeAuthHeaders(), Accept: "application/json" },
      cache: "no-store",
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new ProviderError(
        `VoiceForge engines request failed (HTTP ${res.status})${body ? `: ${body.slice(0, 200)}` : ""}`,
        res.status,
        "voiceforge",
      );
    }
    const engines = z.array(engineSchema).parse(await res.json());
    return NextResponse.json({ engines });
  } catch (e) {
    return errorResponse(e);
  }
}
