/**
 * Idempotent seed: short HyperFrames demo project for OSS launch screenshots.
 *
 * Creates (or refreshes) "Content Creation in 30 Seconds" with 3 scenes in
 * portrait, landscape, and square orientations when --all-formats is passed.
 *
 * Usage:
 *   npx tsx scripts/seed-demo-project.ts
 *   npx tsx scripts/seed-demo-project.ts --all-formats
 */

import { PrismaClient } from "@prisma/client";

import {
  DEMO_VIDEO_PROJECT_NAME,
  DEMO_VIDEO_SCENES,
  DEMO_VIDEO_SCRIPT_NAME,
} from "../src/library/demo-content";

const prisma = new PrismaClient();

const FORMATS: { suffix: string; width: number; height: number }[] = [
  { suffix: "", width: 1080, height: 1920 }, // portrait
];

const ALL_FORMATS: { suffix: string; width: number; height: number }[] = [
  { suffix: " (9:16)", width: 1080, height: 1920 },
  { suffix: " (16:9)", width: 1920, height: 1080 },
  { suffix: " (1:1)", width: 1080, height: 1080 },
];

async function ensureBrandKitId(): Promise<string | null> {
  const kit =
    (await prisma.brandKit.findFirst({ where: { name: "Coral Harbor" } })) ??
    (await prisma.brandKit.findFirst({ orderBy: { createdAt: "asc" } }));
  return kit?.id ?? null;
}

async function upsertDemoProject(
  name: string,
  width: number,
  height: number,
  brandKitId: string | null,
): Promise<{ projectId: string; scriptId: string }> {
  const existing = await prisma.project.findFirst({
    where: { name },
    include: { scripts: { orderBy: { createdAt: "asc" }, take: 1 } },
  });

  if (existing) {
    const scriptId = existing.scripts[0]?.id;
    if (!scriptId) throw new Error(`Project "${name}" has no script`);

    await prisma.project.update({
      where: { id: existing.id },
      data: { videoEngine: "hyperframes", brandKitId },
    });
    await prisma.script.update({
      where: { id: scriptId },
      data: {
        name: DEMO_VIDEO_SCRIPT_NAME,
        width,
        height,
        musicUrl: "/music/upbeat-drive.wav",
        musicVolume: 18,
        brandOverrides: JSON.stringify({
          styleId: "clean-story",
          energy: "normal",
        }),
      },
    });
    await prisma.scene.deleteMany({ where: { scriptId } });
    await prisma.scene.createMany({
      data: DEMO_VIDEO_SCENES.map((scene, order) => ({
        scriptId,
        order,
        templateId: scene.templateId,
        text: scene.text,
        spokenText: scene.spokenText,
        emphasis: JSON.stringify([...scene.emphasis]),
        visual: "visual" in scene ? scene.visual : null,
      })),
    });
    return { projectId: existing.id, scriptId };
  }

  const project = await prisma.project.create({
    data: {
      name,
      videoEngine: "hyperframes",
      brandKitId,
      scripts: {
        create: {
          name: DEMO_VIDEO_SCRIPT_NAME,
          width,
          height,
          musicUrl: "/music/upbeat-drive.wav",
          musicVolume: 18,
          brandOverrides: JSON.stringify({
            styleId: "clean-story",
            energy: "normal",
          }),
          scenes: {
            create: DEMO_VIDEO_SCENES.map((scene, order) => ({
              order,
              templateId: scene.templateId,
              text: scene.text,
              spokenText: scene.spokenText,
              emphasis: JSON.stringify([...scene.emphasis]),
              visual: "visual" in scene ? scene.visual : null,
            })),
          },
        },
      },
    },
    include: { scripts: true },
  });

  return { projectId: project.id, scriptId: project.scripts[0].id };
}

async function main() {
  const allFormats = process.argv.includes("--all-formats");
  const formats = allFormats ? ALL_FORMATS : FORMATS;
  const brandKitId = await ensureBrandKitId();

  for (const format of formats) {
    const name = `${DEMO_VIDEO_PROJECT_NAME}${format.suffix}`;
    const { projectId, scriptId } = await upsertDemoProject(
      name,
      format.width,
      format.height,
      brandKitId,
    );
    console.log(`Demo project ready: ${name}`);
    console.log(`  projectId=${projectId}`);
    console.log(`  scriptId=${scriptId}`);
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
