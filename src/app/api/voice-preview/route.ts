import { NextResponse } from "next/server";
import { z } from "zod";

import { getOrCreateVoicePreview, VOICE_PREVIEW_TEXT } from "@/library/voice-preview";
import { PROVIDER_IDS } from "@/providers/voice/types";
import { authorize } from "@/server/auth";
import { errorResponse } from "@/server/api-helpers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bodySchema = z.object({
  providerId: z.enum(PROVIDER_IDS),
  voiceId: z.string().trim().min(1).max(200),
  modelId: z.string().trim().max(200).optional(),
  text: z.string().trim().max(200).optional(),
});

/** POST /api/voice-preview — synth (or cache-hit) a short reusable voice sample. */
export async function POST(req: Request) {
  try {
    authorize(req);
    const body = bodySchema.parse(await req.json());
    const result = await getOrCreateVoicePreview({
      providerId: body.providerId,
      voiceId: body.voiceId,
      modelId: body.modelId,
      text: body.text || VOICE_PREVIEW_TEXT,
    });
    return NextResponse.json({
      ...result,
      text: body.text || VOICE_PREVIEW_TEXT,
    });
  } catch (e) {
    return errorResponse(e);
  }
}
