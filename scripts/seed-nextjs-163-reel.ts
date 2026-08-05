/**
 * Premium fact-checked Next.js 16.3 HyperFrames reel (~40–55s).
 *
 * Accurate claims (NOT "90% faster"):
 * - up to 90% less RAM on long `next dev`
 * - Turbopack disk cache + memory eviction (on by default)
 * - up to 5.5× faster repeat builds (Vercel CI)
 * - up to +22% SSR requests under load
 *
 * Usage: npx tsx scripts/seed-nextjs-163-reel.ts
 */

import { PrismaClient } from "@prisma/client";

import { createProjectFromPlan } from "../src/library/repositories/projects";
import { updateScript } from "../src/library/repositories/scripts";
import { autoAttachBundledMusic } from "../src/library/soundtrack-service";
import { ensureSfxCues } from "../src/library/sfx-service";
import { generateTake } from "../src/library/take-service";
import type { ScenePlan } from "../src/providers/ai/types";

const prisma = new PrismaClient();

const TITLE = "Next.js 16.3: Leaner memory, faster builds";
const SCRIPT = "Leaner. Faster. Still Next.";

/** Slightly slow Heart reads more natural for tech narration. */
const VOICE_ID = "af_heart";
const VOICE_SPEED = 0.92;

const plan: ScenePlan = {
  projectName: TITLE,
  scriptName: SCRIPT,
  styleId: "clean-story",
  energy: "high",
  voiceStyle: undefined,
  scenes: [
    {
      text: "Next.js 16.3 just dropped.",
      spokenText:
        "Okay — Next.js sixteen point three just shipped. And before the headlines get it wrong…",
      templateId: "hf-kinetic-slam",
      emphasis: ["16.3"],
      mood: "energetic",
      musicMood: "tech minimal",
    },
    {
      text: "It's not 90% faster.",
      spokenText:
        "It's not ninety percent faster. That claim is wrong.",
      templateId: "hf-opener",
      emphasis: ["not", "faster"],
      mood: "dramatic",
      musicMood: "cinematic tension",
    },
    {
      text: "Up to 90% less RAM on long next-dev.",
      spokenText:
        "The real headline: long next-dev sessions can use up to ninety percent less memory.",
      templateId: "hf-money-count",
      visual: "90%",
      emphasis: ["90%"],
      mood: "dramatic",
      musicMood: "cinematic tech",
    },
    {
      text: "What's new in Turbopack",
      spokenText:
        "Turbopack now ships disk caching and memory eviction — on by default.",
      templateId: "hf-list",
      visual: "→",
      emphasis: ["Turbopack"],
      mood: "tech",
      musicMood: "tech minimal",
      items: [
        "Disk cache on by default",
        "Memory eviction built in",
        "Same workflow. Less RAM.",
      ],
    },
    {
      text: "Repeat builds climb hard.",
      spokenText:
        "On Vercel's CI numbers, some repeat builds run up to five point five times faster.",
      templateId: "hf-data-chart",
      visual: "5.5× repeat builds",
      emphasis: ["5.5×"],
      mood: "tech",
      musicMood: "tech minimal",
      // Intentional ascending series (normalized to max in the chart stage).
      items: ["12", "18", "28", "41", "55"],
    },
    {
      text: "SSR handles more traffic.",
      spokenText:
        "And server rendering can handle up to twenty-two percent more requests under load — with no app code changes.",
      templateId: "hf-stat",
      visual: "+22%",
      emphasis: ["+22%"],
      mood: "inspiring",
      musicMood: "tech minimal",
    },
    {
      text: "Feel it the next time you leave next-dev running.",
      spokenText:
        "You'll feel it the next time you leave next-dev running all afternoon.",
      templateId: "hf-app-showcase",
      visual: "next-dev",
      emphasis: ["next-dev"],
      mood: "tech",
      musicMood: "upbeat tech",
    },
    {
      text: "Upgrade. Same Next. Less memory.",
      spokenText:
        "Upgrade to Next.js sixteen point three. Less memory. Faster builds. Same Next you already know.",
      templateId: "hf-logo-outro",
      visual: "nextjs.org",
      emphasis: ["Upgrade"],
      mood: "inspiring",
      musicMood: "tech minimal",
    },
  ],
};

async function main() {
  const existing = await prisma.project.findFirst({
    where: {
      OR: [
        { name: TITLE },
        { name: "Next.js 16.3: 90% less memory" },
      ],
    },
    include: { scripts: true },
  });
  if (existing) {
    await prisma.project.delete({ where: { id: existing.id } });
    console.log(`Removed previous project ${existing.id}`);
  }

  const created = await createProjectFromPlan(
    plan,
    "portrait",
    [],
    "hyperframes",
    { styleId: "clean-story", energy: "high" },
  );

  await autoAttachBundledMusic(created.scriptId);
  // Force a tight tech bed under the VO (auto-attach can pick upbeat-drive).
  await updateScript(created.scriptId, {
    musicUrl: "/music/tech-minimal.wav",
    musicVolume: 16,
  });
  await ensureSfxCues(created.scriptId, { force: true });

  console.log("Project ready:");
  console.log(`  projectId=${created.projectId}`);
  console.log(`  scriptId=${created.scriptId}`);
  console.log(
    `Generating voiceover (kokoro-server / ${VOICE_ID} @ ${VOICE_SPEED}×)…`,
  );

  const take = await generateTake({
    scriptId: created.scriptId,
    providerId: "kokoro-server",
    voiceId: VOICE_ID,
    speed: VOICE_SPEED,
    label: `Heart ${VOICE_SPEED}× · Next.js 16.3`,
    onProgress: (p) => {
      const working =
        p.phase === "synthesizing" && "workingOn" in p && p.workingOn
          ? ` (working #${p.workingOn})`
          : "";
      process.stdout.write(
        `\r  ${p.phase} ${p.scene}/${p.sceneCount}${working}   `,
      );
    },
  });

  console.log("\nTake ready:");
  console.log(`  takeId=${take.id}`);
  console.log(`  audioUrl=${take.audioUrl}`);
  console.log(`  durationFrames=${take.totalFrames} @ ${take.fps}fps`);
  console.log(
    `  ~${(take.totalFrames / take.fps).toFixed(1)}s spoken (target 30–60s)`,
  );
  console.log(`  open: http://localhost:3000/editor/${created.scriptId}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
