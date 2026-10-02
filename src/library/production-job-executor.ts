import type { ClaimedProductionJob } from "@/production/jobs";
import type { ProductionJobExecution } from "@/library/production-worker";
import { executeVideoProductionJob } from "@/library/video-production-orchestrator";
import { executeAudiogramProductionJob } from "@/library/audiogram-production-orchestrator";
import {
  executeAudioProductionJob,
  executePodcastProductionJob,
} from "@/library/audio-production-orchestrator";

import { executeEditorVoiceJob } from "@/library/editor-jobs";

export async function executeProductionJob(
  job: ClaimedProductionJob,
  context: ProductionJobExecution,
): Promise<void> {
  if (job.kind === "editor_voice") return executeEditorVoiceJob(job, context);
  if (job.kind === "video") return executeVideoProductionJob(job, context);
  if (job.kind === "audiogram")
    return executeAudiogramProductionJob(job, context);
  if (job.kind === "audio") return executeAudioProductionJob(job, context);
  if (job.kind === "podcast") return executePodcastProductionJob(job, context);
  throw new Error(`Unsupported production kind: ${job.kind}`);
}
