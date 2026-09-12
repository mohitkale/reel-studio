import path from "node:path";

import { getAssetStore } from "@/library/storage";

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

export function productionJobView(job: {
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
}) {
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
