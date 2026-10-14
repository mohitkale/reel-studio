/**
 * Real local podcast production smoke test.
 * Uses an isolated SQLite database, Kokoro Server, the turn cache, and ffmpeg.
 */
import { DatabaseSync } from "node:sqlite";
import {
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  mkdirSync,
  writeFileSync,
} from "node:fs";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import path from "node:path";

const directory = mkdtempSync(path.join(tmpdir(), "reel-podcast-audio-"));
const filename = path.join(directory, "podcast.db");
const sqlite = new DatabaseSync(filename);
for (const migration of readdirSync("prisma/migrations")
  .filter((name) => !name.endsWith(".toml"))
  .sort()) {
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
    const evidence = process.argv
      .find((arg) => arg.startsWith("--evidence="))
      ?.slice("--evidence=".length);
    if (evidence) {
      const target = path.resolve(evidence);
      mkdirSync(target, { recursive: true });
      const savedTake = takes.find((take) => take.id === second.id);
      if (!savedTake) throw new Error("Generated take was not persisted");
      for (const [name, key] of [
        ["podcast.wav", savedTake.audioPath],
        ["podcast.mp3", savedTake.mp3Path],
      ] as const) {
        if (!key) throw new Error(`Missing ${name}`);
        writeFileSync(path.join(target, name), await getAssetStore().get(key));
      }
      if (process.argv.includes("--audiogram")) {
        execFileSync(
          process.execPath,
          [
            "--import",
            "tsx",
            "scripts/render-podcast-audiogram.ts",
            second.id,
            `--evidence=${target}`,
          ],
          {
            env: { ...process.env, DATABASE_URL: `file:${filename}` },
            stdio: "inherit",
            timeout: 300_000,
          },
        );
      }
      writeFileSync(
        path.join(target, "audio-report.json"),
        JSON.stringify(
          {
            provider: "kokoro-server",
            voices: ["af_bella", "am_adam"],
            cachedTurns: cached.length,
            selectiveRegeneration: finalProgress,
            legacyMp3Export: true,
            wavAndMp3: true,
            audiogram: process.argv.includes("--audiogram"),
          },
          null,
          2,
        ),
      );
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
