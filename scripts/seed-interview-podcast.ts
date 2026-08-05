/**
 * Seed + generate LinkedIn interview podcast audio.
 * Host (open/close) → am_michael
 * Interviewer       → hm_omega (Hindi male)
 * Candidate         → af_heart
 *
 * Usage: npx tsx scripts/seed-interview-podcast.ts
 */

import { PrismaClient } from "@prisma/client";

import {
  INTERVIEW_SCENES,
  INTERVIEW_VOICES,
  interviewVoiceRole,
  type InterviewVoiceRole,
} from "../src/library/interview-linkedin-content";
import { generatePodcastTake } from "../src/library/podcast-take-service";

const prisma = new PrismaClient();

const TITLE = "Would you hire her? (Interview audio)";
const DESCRIPTION =
  "Mock interview audio. Host (am_michael) + Interviewer (hm_omega, Hindi) + Candidate (af_heart).";

type Turn = { characterKey: InterviewVoiceRole; text: string };

function buildTurns(): Turn[] {
  const turns: Turn[] = [];
  for (const scene of INTERVIEW_SCENES) {
    const row = scene as { text?: string; spokenText?: string; visual?: string };
    const spoken = String(
      row.spokenText != null ? row.spokenText : row.text || "",
    ).trim();
    if (!spoken || spoken === "…" || spoken === "...") continue;
    const who = interviewVoiceRole({
      visual: row.visual,
      spoken,
      text: row.text,
    });
    turns.push({ characterKey: who, text: spoken });
  }
  return turns;
}

const CAST: Array<{
  key: InterviewVoiceRole;
  name: string;
  gender: string;
  definition: string;
  order: number;
}> = [
  {
    key: "host",
    name: "Host",
    gender: "male",
    definition: "Warm narrator. Frames the story at the open and close.",
    order: 0,
  },
  {
    key: "interviewer",
    name: "Interviewer",
    gender: "male",
    definition: "Hindi-speaking hiring manager. Measured, slightly cold in-room.",
    order: 1,
  },
  {
    key: "candidate",
    name: "Candidate",
    gender: "female",
    definition: "Earnest fresher. Nervous at first, then quietly powerful.",
    order: 2,
  },
];

async function main() {
  const turns = buildTurns();
  let podcast = await prisma.podcast.findFirst({
    where: { title: TITLE },
    include: { characters: { orderBy: { order: "asc" } } },
  });

  if (!podcast) {
    podcast = await prisma.podcast.create({
      data: {
        title: TITLE,
        description: DESCRIPTION,
        length: "medium",
        characters: {
          create: CAST.map((c) => ({
            key: c.key,
            name: c.name,
            gender: c.gender,
            definition: c.definition,
            providerId: INTERVIEW_VOICES[c.key].providerId,
            voiceId: INTERVIEW_VOICES[c.key].voiceId,
            order: c.order,
          })),
        },
      },
      include: { characters: { orderBy: { order: "asc" } } },
    });
  } else {
    await prisma.podcast.update({
      where: { id: podcast.id },
      data: { description: DESCRIPTION, length: "medium" },
    });

    const existingKeys = new Set(podcast.characters.map((c) => c.key));
    for (const c of CAST) {
      const voice = INTERVIEW_VOICES[c.key];
      const found = podcast.characters.find((x) => x.key === c.key);
      if (found) {
        await prisma.podcastCharacter.update({
          where: { id: found.id },
          data: {
            name: c.name,
            gender: c.gender,
            definition: c.definition,
            providerId: voice.providerId,
            voiceId: voice.voiceId,
            order: c.order,
          },
        });
      } else {
        await prisma.podcastCharacter.create({
          data: {
            podcastId: podcast.id,
            key: c.key,
            name: c.name,
            gender: c.gender,
            definition: c.definition,
            providerId: voice.providerId,
            voiceId: voice.voiceId,
            order: c.order,
          },
        });
      }
      existingKeys.delete(c.key);
    }
    // Drop obsolete cast keys (e.g. old 2-person setup leftovers are fine to keep if unused).
    void existingKeys;

    podcast = await prisma.podcast.findUniqueOrThrow({
      where: { id: podcast.id },
      include: { characters: { orderBy: { order: "asc" } } },
    });
  }

  const byKey = new Map(podcast.characters.map((c) => [c.key, c.id]));
  for (const key of ["host", "interviewer", "candidate"] as const) {
    if (!byKey.has(key)) throw new Error(`Missing character: ${key}`);
  }

  await prisma.podcastTurn.deleteMany({ where: { podcastId: podcast.id } });
  await prisma.podcastTurn.createMany({
    data: turns.map((t, order) => ({
      podcastId: podcast.id,
      characterId: byKey.get(t.characterKey)!,
      order,
      text: t.text,
    })),
  });

  console.log(`Podcast ready: ${TITLE}`);
  console.log(`  podcastId=${podcast.id}`);
  console.log(`  turns=${turns.length}`);
  console.log(
    `  Voices: Host=${INTERVIEW_VOICES.host.voiceId}, Interviewer=${INTERVIEW_VOICES.interviewer.voiceId}, Candidate=${INTERVIEW_VOICES.candidate.voiceId}`,
  );
  console.log("Generating take with kokoro-server (this may take a few minutes)…");

  const take = await generatePodcastTake({
    podcastId: podcast.id,
    label: "Interview cut (3-voice)",
    onProgress: (p) => {
      if (p.phase === "synthesizing") {
        process.stdout.write(
          `\r  synth ${p.scene}/${p.sceneCount}` +
            (p.workingOn ? ` (working #${p.workingOn})` : "") +
            "   ",
        );
      } else {
        process.stdout.write(`\r  stitching ${p.scene}/${p.sceneCount}   `);
      }
    },
  });

  console.log("\nTake generated:");
  console.log(`  takeId=${take.id}`);
  console.log(`  audioUrl=${take.audioUrl}`);
  console.log(`  durationFrames=${take.totalFrames} @ ${take.fps}fps`);
  console.log(`  open: http://localhost:3000/podcasts/${podcast.id}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
