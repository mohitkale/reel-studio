import { createHash } from "node:crypto";

import type { ClaimedProductionJob } from "@/production/jobs";
import {
  audioProductionJobInputSchema,
  podcastProductionJobInputSchema,
} from "@/production/jobs";
import { generateTake } from "@/library/take-service";
import { generatePodcastTake } from "@/library/podcast-take-service";
import { prisma } from "@/library/db";
import { getAssetStore } from "@/library/storage";
import { parseWav } from "@/lib/wav";
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

async function completeStaticSteps(jobId: string) {
  for (const key of ["validate", "plan", "resolve_media"] as const) {
    await upsertProductionJobStep(jobId, key, {
      state: "succeeded",
      progress: 1,
    });
  }
}

async function verifyWav(key: string) {
  const data = await getAssetStore().get(key);
  const info = parseWav(data);
  const duration = info.dataLength / (info.sampleRate * info.channels * 2);
  if (!Number.isFinite(duration) || duration <= 0) {
    throw new Error("Produced WAV is empty or undecodable");
  }
  return {
    bytes: data.length,
    duration,
    sampleRate: info.sampleRate,
    channels: info.channels,
    checksum: `sha256:${createHash("sha256").update(data).digest("hex")}`,
  };
}

export async function executeAudioProductionJob(
  job: ClaimedProductionJob,
  context: Context,
) {
  const input = audioProductionJobInputSchema.parse(job.inputSnapshot);
  await assertActive(context);
  await completeStaticSteps(job.id);
  await upsertProductionJobStep(job.id, "synthesize_audio", {
    state: "running",
    progress: 0,
  });
  const take = await generateTake({
    ...input,
    onProgress: (progress) => {
      const value =
        progress.sceneCount > 0 ? progress.scene / progress.sceneCount : 0;
      void upsertProductionJobStep(job.id, "synthesize_audio", {
        state: "running",
        progress: Math.min(0.95, value),
        detail: progress,
      });
    },
  });
  await upsertProductionJobStep(job.id, "synthesize_audio", {
    state: "succeeded",
    progress: 1,
    detail: { takeId: take.id },
  });
  for (const key of [
    "time_content",
    "prepare_composition",
    "render_export",
  ] as const) {
    await upsertProductionJobStep(job.id, key, {
      state: "succeeded",
      progress: 1,
    });
  }
  await assertActive(context);
  await upsertProductionJobStep(job.id, "verify_artifacts", {
    state: "running",
    progress: 0,
  });
  const row = await prisma.voiceTake.findUniqueOrThrow({
    where: { id: take.id },
  });
  const metadata = await verifyWav(row.audioPath);
  await addProductionJobOutput(job.id, {
    kind: "audio",
    format: "wav",
    path: row.audioPath,
    checksum: metadata.checksum,
    metadata: { ...metadata, takeId: take.id },
  });
  await upsertProductionJobStep(job.id, "verify_artifacts", {
    state: "succeeded",
    progress: 1,
    detail: metadata,
  });
}

export async function executePodcastProductionJob(
  job: ClaimedProductionJob,
  context: Context,
) {
  const input = podcastProductionJobInputSchema.parse(job.inputSnapshot);
  await assertActive(context);
  await completeStaticSteps(job.id);
  await upsertProductionJobStep(job.id, "synthesize_audio", {
    state: "running",
    progress: 0,
  });
  const take = await generatePodcastTake({
    ...input,
    onProgress: (progress) => {
      const value =
        progress.sceneCount > 0 ? progress.scene / progress.sceneCount : 0;
      void upsertProductionJobStep(job.id, "synthesize_audio", {
        state: "running",
        progress: Math.min(0.95, value),
        detail: progress,
      });
    },
  });
  await upsertProductionJobStep(job.id, "synthesize_audio", {
    state: "succeeded",
    progress: 1,
    detail: { takeId: take.id },
  });
  for (const key of [
    "time_content",
    "prepare_composition",
    "render_export",
  ] as const) {
    await upsertProductionJobStep(job.id, key, {
      state: "succeeded",
      progress: 1,
    });
  }
  await assertActive(context);
  await upsertProductionJobStep(job.id, "verify_artifacts", {
    state: "running",
    progress: 0,
  });
  const row = await prisma.podcastTake.findUniqueOrThrow({
    where: { id: take.id },
  });
  const metadata = await verifyWav(row.audioPath);
  await addProductionJobOutput(job.id, {
    kind: "podcast",
    format: "wav",
    path: row.audioPath,
    checksum: metadata.checksum,
    metadata: { ...metadata, takeId: take.id },
  });
  if (row.mp3Path) {
    const mp3 = await getAssetStore().get(row.mp3Path);
    if (mp3.length > 0) {
      await addProductionJobOutput(job.id, {
        kind: "podcast",
        format: "mp3",
        path: row.mp3Path,
        checksum: `sha256:${createHash("sha256").update(mp3).digest("hex")}`,
        metadata: { bytes: mp3.length, takeId: take.id },
      });
    }
  }
  await upsertProductionJobStep(job.id, "verify_artifacts", {
    state: "succeeded",
    progress: 1,
    detail: metadata,
  });
}
