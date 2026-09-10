/**
 * Seed the LinkedIn “Would you hire her?” HyperFrames interview project.
 *
 * Usage: npx tsx scripts/seed-interview-linkedin.ts
 */

import { createPrismaClient } from "../src/library/prisma-client";

import {
  INTERVIEW_PROJECT_NAME,
  INTERVIEW_SCENES,
  INTERVIEW_SCRIPT_NAME,
} from "../src/library/interview-linkedin-content";

const prisma = createPrismaClient();

async function ensureBrandKitId(): Promise<string | null> {
  const kit =
    (await prisma.brandKit.findFirst({ where: { name: "Coral Harbor" } })) ??
    (await prisma.brandKit.findFirst({ orderBy: { createdAt: "asc" } }));
  return kit?.id ?? null;
}

async function main() {
  const brandKitId = await ensureBrandKitId();
  const existing = await prisma.project.findFirst({
    where: { name: INTERVIEW_PROJECT_NAME },
    include: { scripts: { orderBy: { createdAt: "asc" }, take: 1 } },
  });

  let projectId: string;
  let scriptId: string;

  if (existing?.scripts[0]) {
    projectId = existing.id;
    scriptId = existing.scripts[0].id;
    await prisma.project.update({
      where: { id: projectId },
      data: { videoEngine: "hyperframes", brandKitId },
    });
    await prisma.script.update({
      where: { id: scriptId },
      data: {
        name: INTERVIEW_SCRIPT_NAME,
        width: 1080,
        height: 1920,
        // Quiet bed — silence matters in this story; keep music very low.
        musicUrl: "/music/soft-ambient.wav",
        musicVolume: 8,
        brandOverrides: JSON.stringify({
          styleId: "clean-story",
          energy: "normal",
          handle: "yourbrand",
        }),
      },
    });
    await prisma.scene.deleteMany({ where: { scriptId } });
  } else {
    const project = await prisma.project.create({
      data: {
        name: INTERVIEW_PROJECT_NAME,
        videoEngine: "hyperframes",
        brandKitId,
        scripts: {
          create: {
            name: INTERVIEW_SCRIPT_NAME,
            width: 1080,
            height: 1920,
            musicUrl: "/music/soft-ambient.wav",
            musicVolume: 8,
            brandOverrides: JSON.stringify({
              styleId: "clean-story",
              energy: "normal",
              handle: "yourbrand",
            }),
          },
        },
      },
      include: { scripts: true },
    });
    projectId = project.id;
    scriptId = project.scripts[0].id;
  }

  // soft-ambient may not exist — fall back to upbeat at near-zero if missing later.
  const musicExists = await import("node:fs/promises")
    .then((fs) =>
      fs
        .access("public/music/soft-ambient.wav")
        .then(() => true)
        .catch(() => false),
    )
    .catch(() => false);
  if (!musicExists) {
    await prisma.script.update({
      where: { id: scriptId },
      data: { musicUrl: null, musicVolume: 0 },
    });
  }

  await prisma.scene.createMany({
    data: INTERVIEW_SCENES.map((scene, order) => {
      const layout: Record<string, unknown> = { mood: scene.mood };
      if (scene.templateId === "hf-list") {
        layout.items = scene.text.split("\n").map((s) => s.trim()).filter(Boolean);
      }
      return {
        scriptId,
        order,
        templateId: scene.templateId,
        text: scene.text,
        spokenText: scene.spokenText,
        emphasis: JSON.stringify([...scene.emphasis]),
        visual: "visual" in scene ? (scene.visual ?? null) : null,
        layoutJson: JSON.stringify(layout),
      };
    }),
  });

  console.log("HyperFrames interview project ready:");
  console.log(`  name:     ${INTERVIEW_PROJECT_NAME}`);
  console.log(`  project:  ${projectId}`);
  console.log(`  script:   ${scriptId}`);
  console.log(`  scenes:   ${INTERVIEW_SCENES.length}`);
  console.log(`  engine:   hyperframes`);
  console.log(`  open:     http://localhost:3000/editor/${scriptId}`);
  console.log("");
  console.log("Next: open the project → Voiceover → per-scene Kokoro clips");
  console.log("  Host / open+close → am_michael");
  console.log("  Interviewer       → hm_omega (Hindi male)");
  console.log("  Candidate         → af_heart");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
