import type { ClaimedProductionJob } from "@/production/jobs";
import type { ProductionJobExecution } from "@/library/production-worker";
import { executeVideoProductionJob } from "@/library/video-production-orchestrator";
import { executeAudiogramProductionJob } from "@/library/audiogram-production-orchestrator";

export async function executeProductionJob(
  job: ClaimedProductionJob,
  context: ProductionJobExecution,
): Promise<void> {
  if (job.kind === "video") return executeVideoProductionJob(job, context);
  if (job.kind === "audiogram")
    return executeAudiogramProductionJob(job, context);
  throw new Error(`Unsupported production kind: ${job.kind}`);
}
