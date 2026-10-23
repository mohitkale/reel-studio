import { randomUUID } from "node:crypto";
import { parseWav } from "@/lib/wav";
import { prisma } from "@/library/db";
import { getAssetStore } from "@/library/storage";
import { createPodcastTake } from "@/library/repositories/podcasts";
import { ProviderError } from "@/providers/voice/types";
export async function importPodcastAudio(podcastId: string, wav: Buffer) {
  if (
    !(await prisma.podcast.findUnique({
      where: { id: podcastId },
      select: { id: true },
    }))
  )
    throw new ProviderError("Podcast not found", 404);
  let info;
  try {
    info = parseWav(wav);
    // The browser normalizes imports to this exact PCM layout. Reject encoded,
    // truncated or malformed uploads before storing bytes as a playable take.
    if (
      wav.length < 44 ||
      wav.toString("ascii", 12, 16) !== "fmt " ||
      wav.readUInt32LE(16) !== 16 ||
      wav.readUInt16LE(20) !== 1 ||
      wav.toString("ascii", 36, 40) !== "data" ||
      wav.readUInt32LE(40) !== wav.length - 44 ||
      wav.readUInt32LE(4) !== wav.length - 8 ||
      info.dataLength % 2 !== 0
    )
      throw new Error("Invalid PCM upload");
  } catch {
    throw new ProviderError("Upload a PCM WAV audio file", 400);
  }
  if (
    info.sampleRate !== 44100 ||
    info.channels !== 1 ||
    info.bitsPerSample !== 16 ||
    info.durationSeconds <= 0 ||
    info.durationSeconds > 900
  )
    throw new ProviderError(
      "Audio must be 44.1 kHz mono 16-bit PCM WAV, up to 15 minutes",
      400,
    );
  const key = `podcasts/imports/${randomUUID()}.wav`,
    store = getAssetStore();
  await store.put(key, wav);
  try {
    return await createPodcastTake({
      podcastId,
      label: "Imported recording",
      providerId: "recording",
      voiceId: "original",
      fps: 30,
      totalFrames: Math.ceil(info.durationSeconds * 30),
      timeline: [],
      chapters: [],
      voices: [],
      audioPath: key,
      finishing: {
        version: 1,
        intro: null,
        outro: null,
        pronunciations: [],
        pauses: [],
      },
    });
  } catch (error) {
    await store.delete(key).catch(() => {});
    throw error;
  }
}
