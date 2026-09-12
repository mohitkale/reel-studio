import { randomUUID } from "node:crypto";
import type { PrismaClient } from "@prisma/client";

import { hashSpokenText } from "@/library/scene-audio-cache";
import { prisma } from "@/library/db";
import { getAssetStore, type AssetStore } from "@/library/storage";

export interface PodcastAudioCacheKey {
  podcastId: string;
  turnId: string;
  providerId: string;
  voiceId: string;
  modelId?: string;
  text: string;
}

function uniqueKey(parts: PodcastAudioCacheKey) {
  return {
    turnId: parts.turnId,
    providerId: parts.providerId,
    voiceId: parts.voiceId,
    modelId: parts.modelId ?? "",
    textHash: hashSpokenText(parts.text),
  };
}

export async function getCachedPodcastTurnWav(
  parts: PodcastAudioCacheKey,
  database: PrismaClient = prisma,
  store: AssetStore = getAssetStore(),
): Promise<Buffer | null> {
  try {
    const row = await database.podcastTurnAudioBeat.findUnique({
      where: {
        turnId_providerId_voiceId_modelId_textHash: uniqueKey(parts),
      },
    });
    if (!row) return null;
    return await store.get(row.audioPath);
  } catch {
    return null;
  }
}

export async function setCachedPodcastTurnWav(
  parts: PodcastAudioCacheKey,
  wav: Buffer,
  database: PrismaClient = prisma,
  store: AssetStore = getAssetStore(),
): Promise<void> {
  const lookup = uniqueKey(parts);
  const previous = await database.podcastTurnAudioBeat.findUnique({
    where: { turnId_providerId_voiceId_modelId_textHash: lookup },
  });
  const key = `podcast-turn-cache/${parts.turnId}-${randomUUID()}.wav`;
  await store.put(key, wav);
  try {
    await database.podcastTurnAudioBeat.upsert({
      where: { turnId_providerId_voiceId_modelId_textHash: lookup },
      create: {
        podcastId: parts.podcastId,
        ...lookup,
        audioPath: key,
      },
      update: { audioPath: key },
    });
  } catch (error) {
    await store.delete(key).catch(() => undefined);
    throw error;
  }
  if (previous?.audioPath && previous.audioPath !== key) {
    await store.delete(previous.audioPath).catch(() => undefined);
  }
}
