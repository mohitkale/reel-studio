import { readSpeechWords, writeSpeechWords } from "@/library/speech-word-store";
import type { SpeechWord } from "@/lib/speech-words";
import type { VoiceStyleId } from "@/lib/voice-styles";
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

/** Keep recording settings in the key so a different reading cannot reuse it. */
export function sceneSynthesisCacheKey(
  sceneId: string,
  spoken: string,
  voice: Pick<SceneAudioCacheKey, "providerId" | "voiceId" | "modelId"> & {
    speed?: number;
    style?: VoiceStyleId;
  },
  pace = 1,
): SceneAudioCacheKey {
  const speed =
    typeof voice.speed === "number" && Number.isFinite(voice.speed)
      ? `\0speed=${voice.speed}`
      : "";
  const style = voice.style ? `\0style=${voice.style}` : "";
  const scenePace = pace === 1 ? "" : `\0pace=${pace}`;
  return {
    sceneId,
    providerId: voice.providerId,
    voiceId: voice.voiceId,
    modelId: voice.modelId,
    text: `${spoken}${speed}${style}${scenePace}`,
  };
}

/** Best-effort scene-audio cache lookup (see SceneAudioBeat in schema.prisma). */
export async function getCachedBeatAudio(
  parts: SceneAudioCacheKey,
): Promise<{ wav: Buffer; words?: SpeechWord[] } | null> {
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
    return {
      wav: await getAssetStore().get(row.audioPath),
      words: await readSpeechWords(row.audioPath),
    };
  } catch {
    return null;
  }
}

/** Best-effort scene-audio cache write; failures never fail generation. */
export async function setCachedBeatWav(
  parts: SceneAudioCacheKey & { scriptId: string },
  wav: Buffer,
  words?: SpeechWord[],
): Promise<void> {
  try {
    const key = `scene-audio-cache/${parts.sceneId}-${randomUUID()}.wav`;
    await getAssetStore().put(key, wav);
    await writeSpeechWords(key, words);
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

export async function getCachedBeatWav(
  parts: SceneAudioCacheKey,
): Promise<Buffer | null> {
  return (await getCachedBeatAudio(parts))?.wav ?? null;
}
