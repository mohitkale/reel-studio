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

/**
 * POST /api/voiceforge/voices — proxy multipart voice creation to VoiceForge.
 * Forwards name, engine_id, tier, consent, language, and audio file(s).
 */
export async function POST(req: Request) {
  try {
    assertConfigured();
    const incoming = await req.formData();
    const outgoing = new FormData();

    for (const key of ["name", "engine_id", "tier", "consent", "language"] as const) {
      const value = incoming.get(key);
      if (value != null) outgoing.append(key, String(value));
    }

    const files = incoming.getAll("files");
    if (files.length === 0) {
      throw new ProviderError("At least one audio file is required.", 400, "voiceforge");
    }
    for (const file of files) {
      if (file instanceof File) outgoing.append("files", file, file.name);
    }

    const res = await fetch(`${voiceforgeBaseUrl()}/v1/voices`, {
      method: "POST",
      headers: voiceforgeAuthHeaders(),
      body: outgoing,
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new ProviderError(
        `VoiceForge could not create the voice (HTTP ${res.status})${body ? `: ${body.slice(0, 300)}` : ""}`,
        res.status,
        "voiceforge",
      );
    }

    const voice = voiceDetailSchema.parse(await res.json());
    return NextResponse.json({ voice }, { status: 201 });
  } catch (e) {
    return errorResponse(e);
  }
}
