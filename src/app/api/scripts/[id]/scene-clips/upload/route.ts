import { NextResponse } from "next/server";
import { z } from "zod";

import { createAllSceneClipsFromUpload } from "@/library/scene-voice-service";
import { getProvider, isProviderId } from "@/providers/voice/registry";
import { ProviderError } from "@/providers/voice/types";
import { authorize } from "@/server/auth";
import { errorResponse } from "@/server/api-helpers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_WAV_BASE64 = 16 * 1024 * 1024;

const uploadSchema = z.object({
  providerId: z.string().min(1),
  voiceId: z.string().min(1),
  modelId: z.string().optional(),
  label: z.string().max(120).optional(),
  beats: z
    .array(
      z.object({
        sceneId: z.string().min(1),
        wavBase64: z.string().min(1).max(MAX_WAV_BASE64),
      }),
    )
    .max(64)
    .default([]),
});

/**
 * Persist per-scene WAVs from browser TTS as SceneVoiceClips, select each,
 * and assemble a VoiceTake.
 */
export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    authorize(req);
    const { id } = await ctx.params;
    const body = uploadSchema.parse(await req.json());

    if (!isProviderId(body.providerId)) {
      throw new ProviderError(`Unknown provider "${body.providerId}"`, 404);
    }
    if (getProvider(body.providerId).runtime !== "client") {
      throw new ProviderError(
        `"${body.providerId}" is not a browser-generated provider`,
        400,
      );
    }

    const { take, clips } = await createAllSceneClipsFromUpload({
      scriptId: id,
      providerId: body.providerId,
      voiceId: body.voiceId,
      modelId: body.modelId,
      label: body.label,
      beats: body.beats.map((b) => ({
        sceneId: b.sceneId,
        wav: Buffer.from(b.wavBase64, "base64"),
      })),
    });

    return NextResponse.json({ take, clips }, { status: 201 });
  } catch (e) {
    return errorResponse(e);
  }
}
