/** Credential-free review fixture saved in the active app database. */
import { prisma } from "../src/library/db";
import { createProjectFromPlan } from "../src/library/repositories/projects";
import { updateSceneWithHistory } from "../src/library/repositories/scenes";
import { createRender } from "../src/library/repositories/renders";
import { runRenderNow } from "../src/library/render-service";
import { generateTake } from "../src/library/take-service";
import { scenePlanSchema } from "../src/providers/ai/types";
import { motionDirection } from "../src/production/motion";

async function main() {
  const { scriptId } = await createProjectFromPlan(
    scenePlanSchema.parse({
      projectName: "Factory review · Motion and data",
      scriptName: "Text timing and supplied chart",
      scenes: [
        {
          text: "One idea. Many formats.",
          templateId: "hf-statement",
          emphasis: ["Many formats"],
        },
        {
          text: "Review every detail.",
          templateId: "hf-statement",
          emphasis: ["detail"],
        },
        {
          text: "Compare the supplied results.",
          templateId: "hf-statement",
          emphasis: [],
        },
      ],
    }),
    "landscape",
  );
  const scenes = await prisma.scene.findMany({
    where: { scriptId },
    orderBy: { order: "asc" },
  });
  await updateSceneWithHistory(scenes[0].id, {
    motion: {
      ...motionDirection("type-impact"),
      textReveal: { durationSeconds: 1.1, ease: "smooth" },
    },
  });
  await updateSceneWithHistory(scenes[1].id, {
    motion: {
      ...motionDirection("type-editorial"),
      textReveal: { durationSeconds: 0.25, ease: "linear" },
    },
  });
  await updateSceneWithHistory(scenes[2].id, {
    chart: {
      labels: ["Draft", "Reviewed", "Published"],
      series: [
        { label: "Episodes", values: [12, -9, 6], unit: "count" },
        { label: "Clips", values: [24, 18, 12], unit: "count" },
      ],
      sourceAttribution: "Synthetic QA data",
    },
  });
  const take = await generateTake({
    scriptId,
    placeholder: true,
    label: "Silent QA timing — no provider used",
  });
  const render = await createRender({
    scriptId,
    voiceTakeId: take.id,
    quality: "draft",
    name: "Factory review · Text timing and chart",
  });
  console.log(
    JSON.stringify({ scriptId, takeId: take.id, renderId: render.id }),
  );
  await runRenderNow({
    renderId: render.id,
    scriptId,
    voiceTakeId: take.id,
    quality: "draft",
    serverBaseUrl: "http://127.0.0.1:3020",
  });
  const deadline = Date.now() + 600000;
  while (Date.now() < deadline) {
    const saved = await prisma.render.findUniqueOrThrow({
      where: { id: render.id },
    });
    if (saved.status === "done") {
      console.log(JSON.stringify({ outputPath: saved.outputPath }));
      return;
    }
    if (saved.status === "error")
      throw new Error(saved.error ?? "Render failed");
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  throw new Error("Review export timed out");
}
main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
