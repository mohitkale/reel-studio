import path from "node:path";

import { getAssetStore } from "@/library/storage";
import { currentVideoRevisionHash } from "@/library/production-revision";
import { videoProductionJobInputSchema } from "@/production/jobs";

function parse(value: string | null): unknown {
  if (!value) return null;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function assetKey(value: string): string {
  if (!path.isAbsolute(value)) return value;
  const mediaRoot = path.resolve(process.cwd(), "media");
  const relative = path.relative(mediaRoot, value);
  if (relative.startsWith("..") || path.isAbsolute(relative)) return value;
  return relative;
}

export function productionJobView(
  job: {
    id: string;
    kind: string;
    state: string;
    priority: number;
    attempt: number;
    cancelRequested: boolean;
    error: string | null;
    createdAt: Date;
    updatedAt: Date;
    startedAt: Date | null;
    finishedAt: Date | null;
    steps: Array<{
      key: string;
      state: string;
      progress: number;
      detailJson: string | null;
      error: string | null;
    }>;
    outputs: Array<{
      id: string;
      kind: string;
      format: string;
      path: string;
      checksum: string | null;
      metadataJson: string | null;
      createdAt: Date;
    }>;
    productionRevision?: {
      id: string;
      projectId: string;
      scriptId: string;
      revisionHash: string;
      source: string;
      createdAt: Date;
    } | null;
  },
  options?: { currentRevisionHash?: string | null },
) {
  const progress =
    job.state === "succeeded"
      ? 1
      : job.steps.length
        ? job.steps.reduce((sum, step) => sum + step.progress, 0) / 8
        : 0;
  return {
    id: job.id,
    kind: job.kind,
    state: job.state,
    progress,
    priority: job.priority,
    attempt: job.attempt,
    cancelRequested: job.cancelRequested,
    error: job.error,
    createdAt: job.createdAt.toISOString(),
    updatedAt: job.updatedAt.toISOString(),
    startedAt: job.startedAt?.toISOString() ?? null,
    finishedAt: job.finishedAt?.toISOString() ?? null,
    revision: job.productionRevision
      ? {
          id: job.productionRevision.id,
          projectId: job.productionRevision.projectId,
          scriptId: job.productionRevision.scriptId,
          submittedHash: job.productionRevision.revisionHash,
          currentHash: options?.currentRevisionHash ?? null,
          conflict:
            typeof options?.currentRevisionHash === "string" &&
            options.currentRevisionHash !== job.productionRevision.revisionHash,
          source: job.productionRevision.source,
          createdAt: job.productionRevision.createdAt.toISOString(),
        }
      : null,
    steps: job.steps.map((step) => ({
      key: step.key,
      state: step.state,
      progress: step.progress,
      detail: parse(step.detailJson),
      error: step.error,
    })),
    outputs: job.outputs.map((output) => ({
      id: output.id,
      kind: output.kind,
      format: output.format,
      checksum: output.checksum,
      metadata: parse(output.metadataJson),
      downloadUrl: getAssetStore().url(assetKey(output.path)),
      createdAt: output.createdAt.toISOString(),
    })),
  };
}

export async function productionJobViewWithRevision(
  job: Parameters<typeof productionJobView>[0] & { inputSnapshot: string },
) {
  if (!job.productionRevision) return productionJobView(job);
  const input = videoProductionJobInputSchema.safeParse(
    parse(job.inputSnapshot),
  );
  let currentRevisionHash: string | null = null;
  if (input.success) {
    currentRevisionHash = await currentVideoRevisionHash(
      input.data.scriptId,
      input.data.voiceTakeId,
    ).catch(() => null);
  }
  return productionJobView(job, { currentRevisionHash });
}
