import { prisma } from "@/library/db";
import { getPodcast, getPodcastTake } from "@/library/repositories/podcasts";
import { getAssetStore } from "@/library/storage";
import {
  podcastChaptersJson,
  podcastTranscriptText,
} from "@/library/podcast-transcript";
import { ProviderError } from "@/providers/voice/types";
import type { ProductionBundleEntry } from "@/library/production-bundle";
export async function podcastBundleEntries(
  takeId: string,
): Promise<ProductionBundleEntry[]> {
  const row = await prisma.podcastTake.findUnique({ where: { id: takeId } });
  const take = await getPodcastTake(takeId);
  if (!row || !take) throw new ProviderError("Take not found", 404);
  const podcast = await getPodcast(take.podcastId);
  if (!podcast) throw new ProviderError("Podcast not found", 404);
  const entries: ProductionBundleEntry[] = [];
  const add = (name: string, content: Buffer) =>
    entries.push({
      name,
      content,
      size: content.length,
      modifiedAt: row.createdAt,
    });
  let total = 0;
  for (const [name, key] of [
    ["episode.wav", row.audioPath],
    ["episode.mp3", row.mp3Path],
  ] as const) {
    if (!key) continue;
    const asset = await getAssetStore().open(key);
    total += asset.size;
    if (total > 128 * 1024 * 1024) {
      await asset.close();
      throw new ProviderError(
        "Episode package exceeds 128 MiB. Download the audio files individually.",
        413,
      );
    }
    add(name, Buffer.from(await new Response(asset.stream()).arrayBuffer()));
  }
  add("transcript.txt", Buffer.from(podcastTranscriptText(podcast, take)));
  add("chapters.json", Buffer.from(podcastChaptersJson(take)));
  add(
    "show-notes.md",
    Buffer.from(
      `# ${podcast.title}\n\n${podcast.description}\n\n${take.chapters.map((c) => `- ${Math.floor(c.startFrame / take.fps / 60)}:${String(Math.floor(c.startFrame / take.fps) % 60).padStart(2, "0")} ${c.title}`).join("\n")}\n`,
    ),
  );
  add(
    "manifest.json",
    Buffer.from(
      JSON.stringify(
        {
          version: 1,
          podcastId: podcast.id,
          takeId: take.id,
          title: podcast.title,
          metadataNote:
            "Title, description and speaker names reflect the current episode; transcript timing, audio and voice assignments belong to this saved take.",
          createdAt: take.createdAt,
          voices: take.voices,
          finishing: take.finishing,
          files: entries.map((e) => e.name),
        },
        null,
        2,
      ),
    ),
  );
  return entries;
}
