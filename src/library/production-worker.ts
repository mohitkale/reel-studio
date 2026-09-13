import {
  claimProductionJob,
  finishProductionJob,
  heartbeatProductionJob,
} from "@/library/repositories/production-jobs";
import type { ClaimedProductionJob } from "@/production/jobs";

export interface ProductionJobExecution {
  signal: AbortSignal;
  heartbeat: () => Promise<boolean>;
}

/** Claims and executes one durable job. A later launcher can call this in a supervised loop. */
export async function runProductionWorkerOnce(args: {
  workerId: string;
  leaseMs?: number;
  execute: (
    job: ClaimedProductionJob,
    context: ProductionJobExecution,
  ) => Promise<void>;
}): Promise<"idle" | "succeeded" | "failed" | "canceled"> {
  const leaseMs = args.leaseMs ?? 30_000;
  const job = await claimProductionJob({ workerId: args.workerId, leaseMs });
  if (!job) return "idle";
  const controller = new AbortController();
  const heartbeat = async () => {
    const alive = await heartbeatProductionJob(job.id, args.workerId, leaseMs);
    if (!alive) controller.abort();
    return alive;
  };
  const timer = setInterval(
    () => void heartbeat(),
    Math.max(1_000, Math.floor(leaseMs / 3)),
  );
  timer.unref();
  try {
    await args.execute(job, { signal: controller.signal, heartbeat });
    const state = controller.signal.aborted ? "canceled" : "succeeded";
    await finishProductionJob(job.id, args.workerId, state);
    return state;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const state = controller.signal.aborted ? "canceled" : "failed";
    await finishProductionJob(job.id, args.workerId, state, message);
    return state;
  } finally {
    clearInterval(timer);
  }
}

export async function drainProductionQueue(args: {
  workerId: string;
  execute: (
    job: ClaimedProductionJob,
    context: ProductionJobExecution,
  ) => Promise<void>;
  maxJobs?: number;
}) {
  const maxJobs = Math.max(1, Math.min(100, args.maxJobs ?? 50));
  let completed = 0;
  while (completed < maxJobs) {
    const ran = await runProductionWorkerOnce({
      workerId: `${args.workerId}:${completed + 1}`,
      execute: args.execute,
    });
    if (ran === "idle") break;
    completed += 1;
  }
  return completed;
}
