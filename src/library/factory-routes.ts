import { after } from "next/server";
import { randomUUID } from "node:crypto";
import { drainProductionQueue } from "@/library/production-worker";
import { executeProductionJob } from "@/library/production-job-executor";
export function wakeFactoryQueue(count: number) {
  if (count)
    after(() =>
      drainProductionQueue({
        workerId: `web-factory:${randomUUID()}`,
        execute: executeProductionJob,
        maxJobs: Math.min(6, count),
      }),
    );
}
