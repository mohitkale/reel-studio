/**
 * Generate mixed podcast-style voiceover for the LinkedIn interview video.
 * Host (open/close) → am_michael
 * Interviewer       → hm_omega (Hindi male)
 * Candidate         → af_heart
 *
 * Usage: npx tsx scripts/seed-interview-video-voiceover.ts
 */

import { createPrismaClient } from "../src/library/prisma-client";

import {
  INTERVIEW_VOICES,
  interviewVoiceRole,
} from "../src/library/interview-linkedin-content";
import {
  assembleVoiceTake,
  generateSceneClip,
} from "../src/library/scene-voice-service";
import { updateScript } from "../src/library/repositories/scripts";
import { hasSpokenContent, resolveSpokenText } from "../src/lib/spoken-text";

const prisma = createPrismaClient();

const SCRIPT_ID = "cms4s3y3e00029k3b3hz0v47w";

async function main() {
  const script = await prisma.script.findUnique({
    where: { id: SCRIPT_ID },
    include: { scenes: { orderBy: { order: "asc" } } },
  });
  if (!script) throw new Error(`Script not found: ${SCRIPT_ID}`);

  await updateScript(SCRIPT_ID, { voiceMode: "per_scene" });

  console.log(`Mixed video voiceover for: ${script.name}`);
  console.log(`  scenes=${script.scenes.length}`);
  console.log(
    `  Host        → ${INTERVIEW_VOICES.host.providerId}/${INTERVIEW_VOICES.host.voiceId}`,
  );
  console.log(
    `  Interviewer → ${INTERVIEW_VOICES.interviewer.providerId}/${INTERVIEW_VOICES.interviewer.voiceId}`,
  );
  console.log(
    `  Candidate   → ${INTERVIEW_VOICES.candidate.providerId}/${INTERVIEW_VOICES.candidate.voiceId}`,
  );

  let done = 0;
  for (const scene of script.scenes) {
    const spoken = resolveSpokenText(scene);
    const role = interviewVoiceRole({
      visual: scene.visual,
      spoken,
      text: scene.text,
    });
    const cast = INTERVIEW_VOICES[role];

    process.stdout.write(
      `\r  synth ${done}/${script.scenes.length} → #${scene.order + 1} ${role} (${cast.voiceId})   `,
    );

    await generateSceneClip({
      sceneId: scene.id,
      providerId: cast.providerId,
      voiceId: cast.voiceId,
      label: `${role} · ${cast.voiceId}`,
      select: true,
      assemble: false,
      placeholder: !hasSpokenContent(scene),
    });
    done += 1;
  }

  process.stdout.write(
    `\r  synth ${done}/${script.scenes.length} — assembling mixed take…          \n`,
  );

  const take = await assembleVoiceTake(SCRIPT_ID);

  console.log("Mixed take ready:");
  console.log(`  takeId=${take.id}`);
  console.log(`  audioUrl=${take.audioUrl}`);
  console.log(`  durationFrames=${take.totalFrames} @ ${take.fps}fps`);
  console.log(`  source=${take.source}`);
  console.log(`  open: http://localhost:3000/editor/${SCRIPT_ID}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
