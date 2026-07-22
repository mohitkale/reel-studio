import { createHash, randomUUID } from "node:crypto";

import { prisma } from "@/library/db";
import { getAssetStore } from "@/library/storage";

export function hashSpokenText(text: string): string {
  return createHash("sha1").update(text).digest("hex");
}

export interface SceneAudioCacheKey {
  sceneId: string;
  providerId: string;
  voiceId: string;
  modelId?: string;
  text: string;
}

/** Best-effort scene-audio cache lookup (see SceneAudioBeat in schema.prisma). */
export async function getCachedBeatWav(
  parts: SceneAudioCacheKey,
): Promise<Buffer | null> {
  try {
    const row = await prisma.sceneAudioBeat.findUnique({
      where: {
        sceneId_providerId_voiceId_modelId_textHash: {
          sceneId: parts.sceneId,
          providerId: parts.providerId,
          voiceId: parts.voiceId,
          modelId: parts.modelId ?? "",
          textHash: hashSpokenText(parts.text),
        },
      },
    });
    if (!row) return null;
    return await getAssetStore().get(row.audioPath);
  } catch {
    return null;
  }
}

/** Best-effort scene-audio cache write; failures never fail generation. */
export async function setCachedBeatWav(
  parts: SceneAudioCacheKey & { scriptId: string },
  wav: Buffer,
): Promise<void> {
  try {
    const key = `scene-audio-cache/${parts.sceneId}-${randomUUID()}.wav`;
    await getAssetStore().put(key, wav);
    await prisma.sceneAudioBeat.upsert({
      where: {
        sceneId_providerId_voiceId_modelId_textHash: {
          sceneId: parts.sceneId,
          providerId: parts.providerId,
          voiceId: parts.voiceId,
          modelId: parts.modelId ?? "",
          textHash: hashSpokenText(parts.text),
        },
      },
      create: {
        scriptId: parts.scriptId,
        sceneId: parts.sceneId,
        providerId: parts.providerId,
        voiceId: parts.voiceId,
        modelId: parts.modelId ?? "",
        textHash: hashSpokenText(parts.text),
        audioPath: key,
      },
      update: { audioPath: key },
    });
  } catch {
    // Non-fatal
  }
}
