import { randomUUID } from "node:crypto";

import { transcodeWavToMp3 } from "@/lib/audio-production";
import { prisma } from "@/library/db";
import { getAssetStore } from "@/library/storage";
import { ProviderError } from "@/providers/voice/types";

export async function preparePodcastTakeExport(
  takeId: string,
  format: "wav" | "mp3",
): Promise<{ format: "wav" | "mp3"; url: string }> {
  const take = await prisma.podcastTake.findUnique({ where: { id: takeId } });
  if (!take) throw new ProviderError("Podcast take not found", 404);
  const store = getAssetStore();
  if (format === "wav") {
    if (!(await store.exists(take.audioPath))) {
      throw new ProviderError(
        "Podcast WAV is missing; regenerate this take",
        409,
      );
    }
    return { format, url: store.url(take.audioPath) };
  }
  if (take.mp3Path && (await store.exists(take.mp3Path))) {
    return { format, url: store.url(take.mp3Path) };
  }

  const wav = await store.get(take.audioPath).catch(() => null);
  if (!wav) {
    throw new ProviderError(
      "Podcast WAV is missing; regenerate this take",
      409,
    );
  }
  let mp3: Buffer;
  try {
    mp3 = await transcodeWavToMp3(wav);
  } catch (error) {
    throw new ProviderError(
      `MP3 export needs ffmpeg${error instanceof Error ? `: ${error.message}` : ""}`,
      503,
    );
  }
  const mp3Path = `podcast-takes/${randomUUID()}.mp3`;
  await store.put(mp3Path, mp3);
  try {
    await prisma.podcastTake.update({
      where: { id: takeId },
      data: { mp3Path },
    });
  } catch (error) {
    await store.delete(mp3Path).catch(() => undefined);
    throw error;
  }
  return { format, url: store.url(mp3Path) };
}
