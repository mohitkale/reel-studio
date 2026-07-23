/**
 * Idempotent seed: short content-creation podcast for OSS launch demos.
 *
 * Usage:
 *   npx tsx scripts/seed-demo-podcast.ts
 */

import { PrismaClient } from "@prisma/client";

import {
  DEMO_PODCAST_DESCRIPTION,
  DEMO_PODCAST_TITLE,
  DEMO_PODCAST_TURNS,
} from "../src/library/demo-content";

const prisma = new PrismaClient();

async function main() {
  let podcast = await prisma.podcast.findFirst({
    where: { title: DEMO_PODCAST_TITLE },
    include: { characters: { orderBy: { order: "asc" } } },
  });

  if (!podcast) {
    podcast = await prisma.podcast.create({
      data: {
        title: DEMO_PODCAST_TITLE,
        description: DEMO_PODCAST_DESCRIPTION,
        length: "short",
        characters: {
          create: [
            {
              key: "maya",
              name: "Maya",
              gender: "female",
              definition:
                "Warm host. Curious, clear, keeps the tip practical.",
              providerId: "kokoro-server",
              voiceId: "af_bella",
              order: 0,
            },
            {
              key: "jordan",
              name: "Jordan",
              gender: "male",
              definition:
                "Practical co-host. Short answers, no fluff.",
              providerId: "kokoro-server",
              voiceId: "am_adam",
              order: 1,
            },
          ],
        },
      },
      include: { characters: { orderBy: { order: "asc" } } },
    });
  } else {
    await prisma.podcast.update({
      where: { id: podcast.id },
      data: {
        description: DEMO_PODCAST_DESCRIPTION,
        length: "short",
      },
    });
    for (const character of podcast.characters) {
      const voice =
        character.key === "maya"
          ? { providerId: "kokoro-server", voiceId: "af_bella" }
          : { providerId: "kokoro-server", voiceId: "am_adam" };
      await prisma.podcastCharacter.update({
        where: { id: character.id },
        data: voice,
      });
    }
    podcast = await prisma.podcast.findUniqueOrThrow({
      where: { id: podcast.id },
      include: { characters: { orderBy: { order: "asc" } } },
    });
  }

  const byKey = new Map(podcast.characters.map((c) => [c.key, c.id]));
  for (const turn of DEMO_PODCAST_TURNS) {
    if (!byKey.has(turn.characterId)) {
      throw new Error(`Missing character key: ${turn.characterId}`);
    }
  }

  await prisma.podcastTurn.deleteMany({ where: { podcastId: podcast.id } });
  await prisma.podcastTurn.createMany({
    data: DEMO_PODCAST_TURNS.map((turn, order) => ({
      podcastId: podcast.id,
      characterId: byKey.get(turn.characterId)!,
      order,
      text: turn.text,
    })),
  });

  console.log(`Demo podcast ready: ${DEMO_PODCAST_TITLE}`);
  console.log(`  podcastId=${podcast.id}`);
  console.log(`  turns=${DEMO_PODCAST_TURNS.length}`);
  console.log(
    "  Voices: Maya=kokoro-server/af_bella, Jordan=kokoro-server/am_adam",
  );
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
