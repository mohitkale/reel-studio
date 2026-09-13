import { randomUUID } from "node:crypto";
import path from "node:path";
import { promises as fs } from "node:fs";

import { prisma } from "../src/library/db";
import {
  enqueueProductionJob,
  getProductionJob,
} from "../src/library/repositories/production-jobs";
import { runProductionWorkerOnce } from "../src/library/production-worker";
import { executeProductionJob } from "../src/library/production-job-executor";
import { podcastTimelineSchema } from "../src/library/podcast-schemas";

async function main() {
  const requestedTakeId = process.argv[2];
  const candidates = await prisma.podcastTake.findMany({
    where: requestedTakeId ? { id: requestedTakeId } : undefined,
    orderBy: { totalFrames: "asc" },
    take: requestedTakeId ? 1 : 20,
  });
  const selected = candidates
    .map((take) => ({
      take,
      timeline: podcastTimelineSchema.parse(JSON.parse(take.timingJson)),
    }))
    .find(({ timeline }) => timeline.length > 0);
  if (!selected)
    throw new Error("No podcast take with timed turns is available");
  const { take, timeline } = selected;
  const end = timeline[Math.min(2, timeline.length - 1)];
  const job = await enqueueProductionJob({
    kind: "audiogram",
    idempotencyKey: `audiogram-smoke:${randomUUID()}`,
    inputSnapshot: {
      takeId: take.id,
      startTurnId: timeline[0].turnId,
      endTurnId: end.turnId,
      orientation: "portrait",
      quality: "draft",
    },
  });
  try {
    const result = await runProductionWorkerOnce({
      workerId: `audiogram-smoke:${process.pid}`,
      execute: executeProductionJob,
    });
    if (result !== "succeeded") throw new Error(`Audiogram worker ${result}`);
    const completed = await getProductionJob(job.id);
    const output = completed?.outputs.find((item) => item.kind === "audiogram");
    if (!output) throw new Error("Audiogram output was not recorded");
    const source = path.join(process.cwd(), "media", output.path);
    const destination = path.join(
      process.cwd(),
      ".artifacts",
      "podcast-audiogram",
      "podcast-audiogram.mp4",
    );
    await fs.mkdir(path.dirname(destination), { recursive: true });
    await fs.copyFile(source, destination);
    console.log(`Audiogram smoke passed: ${destination}`);
  } finally {
    const completed = await getProductionJob(job.id).catch(() => null);
    await Promise.all(
      (completed?.outputs ?? []).map((output) =>
        fs.rm(path.join(process.cwd(), "media", output.path), { force: true }),
      ),
    );
    await prisma.productionJob
      .delete({ where: { id: job.id } })
      .catch(() => undefined);
    await prisma.$disconnect();
  }
}

void main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
