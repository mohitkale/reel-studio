/**
 * Real local podcast production smoke test.
 * Uses an isolated SQLite database, Kokoro Server, the turn cache, and ffmpeg.
 */
import { DatabaseSync } from "node:sqlite";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const directory = mkdtempSync(path.join(tmpdir(), "reel-podcast-audio-"));
const filename = path.join(directory, "podcast.db");
const sqlite = new DatabaseSync(filename);
for (const migration of [
  "20260910000100_baseline",
  "20260912000200_audio_production",
]) {
  sqlite.exec(
    readFileSync(`prisma/migrations/${migration}/migration.sql`, "utf8"),
  );
}
sqlite.close();
process.env.DATABASE_URL = `file:${filename}`;

async function main() {
  const [
    { prisma },
    { getAssetStore },
    { generatePodcastTake },
    { preparePodcastTakeExport },
  ] = await Promise.all([
    import("../src/library/db"),
    import("../src/library/storage"),
    import("../src/library/podcast-take-service"),
    import("../src/library/podcast-export-service"),
  ]);
  const paths = new Set<string>();
  try {
    const podcast = await prisma.podcast.create({
      data: {
        title: "Podcast audio verification",
        characters: {
          create: [
            {
              key: "host",
              name: "Host",
              providerId: "kokoro-server",
              voiceId: "af_bella",
              order: 0,
            },
            {
              key: "guest",
              name: "Guest",
              providerId: "kokoro-server",
              voiceId: "am_adam",
              order: 1,
            },
          ],
        },
      },
      include: { characters: { orderBy: { order: "asc" } } },
    });
    const turns = await Promise.all([
      prisma.podcastTurn.create({
        data: {
          podcastId: podcast.id,
          characterId: podcast.characters[0].id,
          order: 0,
          text: "Welcome. This short test verifies reusable podcast audio.",
        },
      }),
      prisma.podcastTurn.create({
        data: {
          podcastId: podcast.id,
          characterId: podcast.characters[1].id,
          order: 1,
          text: "Only one turn should be synthesized again on the second pass.",
        },
      }),
    ]);

    const first = await generatePodcastTake({ podcastId: podcast.id });
    const legacyRow = await prisma.podcastTake.findUniqueOrThrow({
      where: { id: first.id },
    });
    if (!legacyRow.mp3Path)
      throw new Error("Initial MP3 output was not stored");
    await getAssetStore().delete(legacyRow.mp3Path);
    await prisma.podcastTake.update({
      where: { id: first.id },
      data: { mp3Path: null },
    });
    const legacyExport = await preparePodcastTakeExport(first.id, "mp3");
    if (!legacyExport.url.endsWith(".mp3")) {
      throw new Error("Legacy take did not receive an on-demand MP3 export");
    }
    const secondProgress: Array<{ cached: number; generated: number }> = [];
    const second = await generatePodcastTake({
      podcastId: podcast.id,
      regenerateTurnIds: [turns[1].id],
      onProgress(progress) {
        if (progress.phase === "synthesizing") {
          secondProgress.push({
            cached: progress.cached,
            generated: progress.generated,
          });
        }
      },
    });

    const takes = await prisma.podcastTake.findMany({
      where: { podcastId: podcast.id },
    });
    const cached = await prisma.podcastTurnAudioBeat.findMany({
      where: { podcastId: podcast.id },
    });
    for (const take of takes) {
      paths.add(take.audioPath);
      if (take.mp3Path) paths.add(take.mp3Path);
    }
    for (const beat of cached) paths.add(beat.audioPath);

    if (!first.mp3Url || !second.mp3Url) {
      throw new Error("Expected WAV and MP3 output for both takes");
    }
    if (cached.length !== 2) {
      throw new Error(
        `Expected two reusable turn beats, found ${cached.length}`,
      );
    }
    const finalProgress = secondProgress.at(-1);
    if (finalProgress?.cached !== 1 || finalProgress.generated !== 1) {
      throw new Error(
        `Expected one reused and one regenerated turn, received ${JSON.stringify(finalProgress)}`,
      );
    }
    for (const path of paths) {
      if (!(await getAssetStore().exists(path))) {
        throw new Error(`Missing generated artifact: ${path}`);
      }
    }
    console.log(
      `Podcast audio smoke passed: ${cached.length} cached turns, one selective regeneration, legacy upgrade, WAV + MP3 artifacts.`,
    );
  } finally {
    for (const key of paths) {
      await getAssetStore()
        .delete(key)
        .catch(() => undefined);
    }
    await prisma.$disconnect();
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => rmSync(directory, { recursive: true, force: true }));
