import { hostname } from "node:os";

import { runProductionWorkerOnce } from "../src/library/production-worker";
import { executeVideoProductionJob } from "../src/library/video-production-orchestrator";

const workerId = `${hostname()}:${process.pid}`;
let stopping = false;
process.once("SIGINT", () => {
  stopping = true;
});
process.once("SIGTERM", () => {
  stopping = true;
});

async function main() {
  console.log(`[production-worker] ${workerId} ready`);
  while (!stopping) {
    const result = await runProductionWorkerOnce({
      workerId,
      execute: async (job, context) => {
        if (job.kind !== "video")
          throw new Error(`Unsupported production kind: ${job.kind}`);
        await executeVideoProductionJob(job, context);
      },
    });
    if (result === "idle")
      await new Promise((resolve) => setTimeout(resolve, 750));
  }
  console.log(`[production-worker] ${workerId} stopped`);
}

void main().catch((error) => {
  console.error("[production-worker] fatal", error);
  process.exitCode = 1;
});
