import path from "node:path";

import { prisma } from "../src/library/db";
import {
  DEMO_VIDEO_PROJECT_NAME,
  DEMO_VIDEO_SCRIPT_NAME,
} from "../src/library/demo-content";
import { generateTake } from "../src/library/take-service";
import { createRender } from "../src/library/repositories/renders";
import { startRender } from "../src/library/render-service";

async function waitForRender(id: string, timeoutMs = 10 * 60 * 1_000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const render = await prisma.render.findUnique({ where: { id } });
    if (!render) throw new Error("Sample render record disappeared");
    if (render.status === "done" && render.outputPath) return render.outputPath;
    if (render.status === "error") {
      throw new Error(render.error ?? "Sample render failed");
    }
    await new Promise((resolve) => setTimeout(resolve, 1_000));
  }
  throw new Error("Sample render timed out after ten minutes");
}

async function main() {
  const project = await prisma.project.findFirst({
    where: { name: DEMO_VIDEO_PROJECT_NAME },
    include: {
      scripts: {
        where: { name: DEMO_VIDEO_SCRIPT_NAME },
        orderBy: { createdAt: "asc" },
        take: 1,
      },
    },
  });
  const script = project?.scripts[0];
  if (!project || !script) {
    throw new Error(
      "Bundled demo project is missing. Run `npm run setup` first.",
    );
  }
  console.log(`→ Preparing local narration for ${project.name}`);
  const take = await generateTake({
    scriptId: script.id,
    placeholder: true,
    label: "Credential-free sample",
  });
  const render = await createRender({
    scriptId: script.id,
    voiceTakeId: take.id,
    quality: "draft",
    name: "Credential-free sample export",
  });
  console.log("→ Rendering the HyperFrames sample locally");
  startRender({
    renderId: render.id,
    scriptId: script.id,
    voiceTakeId: take.id,
    quality: "draft",
    serverBaseUrl: "http://127.0.0.1:3000",
  });
  const output = await waitForRender(render.id);
  const absolute = path.isAbsolute(output)
    ? output
    : path.resolve(process.cwd(), "media", output.replace(/^\/?media\//, ""));
  console.log(`\n✓ Sample export ready: ${absolute}`);
  console.log("Open Reel Studio → Renders to preview and download it.");
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());
