// @vitest-environment node
import { DatabaseSync } from "node:sqlite";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { createPrismaClient } from "@/library/prisma-client";
import { LocalDiskStore } from "@/library/storage/local-disk";
import {
  getCachedPodcastTurnWav,
  setCachedPodcastTurnWav,
} from "@/library/podcast-audio-cache";
import { makeSilentWav } from "@/lib/wav";

describe("podcast turn audio cache", () => {
  let directory: string;
  let previous: string | undefined;
  let client: ReturnType<typeof createPrismaClient>;
  let turnId: string;
  let podcastId: string;
  let store: LocalDiskStore;

  beforeEach(async () => {
    directory = mkdtempSync(path.join(tmpdir(), "reel-podcast-cache-"));
    const filename = path.join(directory, "cache.db");
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
    previous = process.env.DATABASE_URL;
    process.env.DATABASE_URL = `file:${filename}`;
    client = createPrismaClient();
    store = new LocalDiskStore(path.join(directory, "media"));
    const podcast = await client.podcast.create({ data: { title: "Cache" } });
    podcastId = podcast.id;
    const character = await client.podcastCharacter.create({
      data: {
        podcastId,
        key: "host",
        name: "Host",
        order: 0,
      },
    });
    const turn = await client.podcastTurn.create({
      data: { podcastId, characterId: character.id, order: 0, text: "Hello" },
    });
    turnId = turn.id;
  });

  afterEach(async () => {
    await client.$disconnect();
    if (previous === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = previous;
    rmSync(directory, { recursive: true, force: true });
  });

  it("reuses only exact text and voice inputs and replaces forced audio", async () => {
    const key = {
      podcastId,
      turnId,
      providerId: "kokoro-server",
      voiceId: "af_heart",
      modelId: "v1",
      text: "Hello",
    };
    const first = makeSilentWav(0.2);
    await setCachedPodcastTurnWav(key, first, client, store);
    expect(
      (await getCachedPodcastTurnWav(key, client, store))?.equals(first),
    ).toBe(true);
    expect(
      await getCachedPodcastTurnWav({ ...key, text: "Edited" }, client, store),
    ).toBeNull();

    const replacement = makeSilentWav(0.3);
    await setCachedPodcastTurnWav(key, replacement, client, store);
    expect(
      (await getCachedPodcastTurnWav(key, client, store))?.equals(replacement),
    ).toBe(true);
    expect(await client.podcastTurnAudioBeat.count()).toBe(1);
  });
});
