import { NextResponse } from "next/server";
import { z } from "zod";

import { createSceneClipFromUpload } from "@/library/scene-voice-service";
import { getProvider, isProviderId } from "@/providers/voice/registry";
import { ProviderError } from "@/providers/voice/types";
import { authorize } from "@/server/auth";
import { errorResponse } from "@/server/api-helpers";
import { prisma } from "@/library/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_WAV_BASE64 = 16 * 1024 * 1024;

const uploadSchema = z.object({
  providerId: z.string().min(1),
  voiceId: z.string().min(1),
  modelId: z.string().optional(),
  label: z.string().max(120).optional(),
  // May be empty when the scene has no spoken text (server writes a silent hold).
  wavBase64: z.string().max(MAX_WAV_BASE64).default(""),
});

/** Persist one browser-generated WAV as a SceneVoiceClip for this scene. */
export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    authorize(req);
    const { id: sceneId } = await ctx.params;
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

    const scene = await prisma.scene.findUnique({
      where: { id: sceneId },
      select: { scriptId: true },
    });
    if (!scene) throw new ProviderError("Scene not found", 404);

    const { clip, take } = await createSceneClipFromUpload({
      scriptId: scene.scriptId,
      sceneId,
      providerId: body.providerId,
      voiceId: body.voiceId,
      modelId: body.modelId,
      label: body.label,
      wav: body.wavBase64
        ? Buffer.from(body.wavBase64, "base64")
        : Buffer.alloc(0),
    });

    return NextResponse.json({ clip, take }, { status: 201 });
  } catch (e) {
    return errorResponse(e);
  }
}
