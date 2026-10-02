import path from "node:path";
import { promises as fs } from "node:fs";

import { renderHyperframesAudiogram } from "@/library/hyperframes-audiogram";

import type {
  ClaimedProductionJob,
  ProductionStepKey,
} from "@/production/jobs";
import { audiogramProductionJobInputSchema } from "@/production/jobs";
import { buildPodcastAudiogramPlan } from "@/library/podcast-audiogram";
import { getPodcastTakeSource } from "@/library/repositories/podcasts";
import { getAssetStore } from "@/library/storage";
import { verifyProductionMp4 } from "@/library/video-production-orchestrator";
import {
  addProductionJobOutput,
  upsertProductionJobStep,
} from "@/library/repositories/production-jobs";

type Context = { signal: AbortSignal; heartbeat: () => Promise<boolean> };

async function assertActive(context: Context) {
  if (context.signal.aborted || !(await context.heartbeat())) {
    throw new Error("Production canceled");
  }
}

export async function executeAudiogramProductionJob(
  job: ClaimedProductionJob,
  context: Context,
): Promise<void> {
  const input = audiogramProductionJobInputSchema.parse(job.inputSnapshot);
  await upsertProductionJobStep(job.id, "validate", {
    state: "running",
    progress: 0,
  });
  const source = await getPodcastTakeSource(input.takeId);
  if (!source) throw new Error("Podcast take not found");
  const sourceWav = await getAssetStore().get(source.audioPath);
  const plan = buildPodcastAudiogramPlan({
    podcast: source.podcast,
    take: source.take,
    sourceWav,
    selection: input,
  });
  await upsertProductionJobStep(job.id, "validate", {
    state: "succeeded",
    progress: 1,
    detail: { selectedTurnIds: plan.selectedTurnIds },
  });

  const resolvedStages: ProductionStepKey[] = [
    "plan",
    "resolve_media",
    "synthesize_audio",
    "time_content",
    "prepare_composition",
  ];
  for (const key of resolvedStages) {
    await assertActive(context);
    await upsertProductionJobStep(job.id, key, {
      state: "succeeded",
      progress: 1,
      detail:
        key === "synthesize_audio"
          ? { reusedOriginalPodcastAudio: true }
          : undefined,
    });
  }

  await upsertProductionJobStep(job.id, "render_export", {
    state: "running",
    progress: 0,
  });
  const outputKey = `audiograms/audiogram-${job.id}.mp4`;
  const outputPath = path.join(process.cwd(), "media", outputKey);
  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await assertActive(context);
  await renderHyperframesAudiogram(
    plan,
    outputPath,
    input.quality,
    context.signal,
  );
  await upsertProductionJobStep(job.id, "render_export", {
    state: "succeeded",
    progress: 1,
  });

  await upsertProductionJobStep(job.id, "verify_artifacts", {
    state: "running",
    progress: 0,
  });
  const metadata = await verifyProductionMp4(outputPath, true);
  await addProductionJobOutput(job.id, {
    kind: "audiogram",
    format: "mp4",
    path: outputKey,
    checksum:
      typeof metadata.checksum === "string" ? metadata.checksum : undefined,
    metadata: {
      ...metadata,
      takeId: input.takeId,
      startTurnId: input.startTurnId,
      endTurnId: input.endTurnId,
      selectedTurnIds: plan.selectedTurnIds,
      originalAudio: true,
    },
  });
  await upsertProductionJobStep(job.id, "verify_artifacts", {
    state: "succeeded",
    progress: 1,
    detail: metadata,
  });
}
