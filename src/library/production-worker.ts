import { withProductionSignal } from "@/library/production-cancellation";
import {
  claimProductionJob,
  finishProductionJob,
  heartbeatProductionJob,
  releaseProductionJob,
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
  /** Route fallback is disabled under the normal supervised launcher. */
  supervised?: boolean;
  signal?: AbortSignal;
  execute: (
    job: ClaimedProductionJob,
    context: ProductionJobExecution,
  ) => Promise<void>;
}): Promise<"idle" | "succeeded" | "failed" | "canceled"> {
  if (process.env.REEL_SUPERVISED_WORKER === "1" && !args.supervised)
    return "idle";
  if (args.signal?.aborted) return "idle";
  const leaseMs = args.leaseMs ?? 30_000;
  const job = await claimProductionJob({ workerId: args.workerId, leaseMs });
  if (!job) return "idle";
  const controller = new AbortController();
  const shutdown = () => controller.abort(new Error("Worker shutting down"));
  args.signal?.addEventListener("abort", shutdown, { once: true });
  if (args.signal?.aborted) shutdown();
  const heartbeat = async () => {
    const alive = await heartbeatProductionJob(job.id, args.workerId, leaseMs);
    if (!alive) controller.abort();
    return alive;
  };
  const timer = setInterval(
    () => void heartbeat().catch((error) => controller.abort(error)),
    Math.max(1_000, Math.floor(leaseMs / 3)),
  );
  timer.unref();
  try {
    await withProductionSignal(controller.signal, () =>
      args.execute(job, { signal: controller.signal, heartbeat }),
    );
    const state = controller.signal.aborted ? "canceled" : "succeeded";
    if (args.signal?.aborted) await releaseProductionJob(job.id, args.workerId);
    else await finishProductionJob(job.id, args.workerId, state);
    return state;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const state = controller.signal.aborted ? "canceled" : "failed";
    if (args.signal?.aborted) await releaseProductionJob(job.id, args.workerId);
    else await finishProductionJob(job.id, args.workerId, state, message);
    return state;
  } finally {
    clearInterval(timer);
    args.signal?.removeEventListener("abort", shutdown);
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
