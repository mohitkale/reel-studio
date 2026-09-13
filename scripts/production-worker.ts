import { hostname } from "node:os";

import { runProductionWorkerOnce } from "../src/library/production-worker";
import { executeProductionJob } from "../src/library/production-job-executor";

const workerId = `${hostname()}:${process.pid}`;
let stopping = false;
const shutdown = new AbortController();
process.once("SIGINT", () => {
  stopping = true;
  shutdown.abort();
});
process.once("SIGTERM", () => {
  stopping = true;
  shutdown.abort();
});

async function main() {
  console.log(`[production-worker] ${workerId} ready`);
  while (!stopping) {
    const result = await runProductionWorkerOnce({
      workerId,
      supervised: true,
      signal: shutdown.signal,
      execute: executeProductionJob,
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
