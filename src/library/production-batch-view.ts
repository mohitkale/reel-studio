import { productionJobView } from "@/library/production-job-view";

export type ProductionBatchState =
  | "queued"
  | "running"
  | "awaiting_approval"
  | "succeeded"
  | "partial_failure"
  | "failed"
  | "canceled";

type BatchRecord = {
  id: string;
  idempotencyKey: string;
  priority: number;
  createdAt: Date;
  updatedAt: Date;
  items: Array<{
    id: string;
    rowIndex: number;
    variantIndex: number;
    label: string | null;
    orientation: string | null;
    validationError: string | null;
    job: Parameters<typeof productionJobView>[0] | null;
  }>;
};

function itemState(item: BatchRecord["items"][number]): string {
  if (item.validationError) return "failed";
  return item.job?.state ?? "queued";
}

export function productionBatchState(batch: BatchRecord): ProductionBatchState {
  const states = batch.items.map(itemState);
  if (states.every((state) => state === "succeeded")) return "succeeded";
  const terminal = states.every((state) =>
    ["succeeded", "failed", "canceled"].includes(state),
  );
  if (terminal) {
    if (states.every((state) => state === "canceled")) return "canceled";
    if (states.some((state) => state === "succeeded")) {
      return "partial_failure";
    }
    return "failed";
  }
  if (states.some((state) => state === "running")) return "running";
  if (states.some((state) => state === "queued")) return "queued";
  return "awaiting_approval";
}

export function productionBatchView(batch: BatchRecord) {
  const items = batch.items.map((item) => {
    const job = item.job ? productionJobView(item.job) : null;
    return {
      id: item.id,
      rowIndex: item.rowIndex,
      variantIndex: item.variantIndex,
      label: item.label,
      orientation: item.orientation,
      state: itemState(item),
      error: item.validationError ?? job?.error ?? null,
      job,
    };
  });
  const progress = items.length
    ? items.reduce(
        (sum, item) =>
          sum + (item.job?.progress ?? (item.state === "failed" ? 1 : 0)),
        0,
      ) / items.length
    : 0;
  return {
    id: batch.id,
    idempotencyKey: batch.idempotencyKey,
    state: productionBatchState(batch),
    progress,
    priority: batch.priority,
    totalItems: items.length,
    succeededItems: items.filter((item) => item.state === "succeeded").length,
    failedItems: items.filter((item) => item.state === "failed").length,
    createdAt: batch.createdAt.toISOString(),
    updatedAt: batch.updatedAt.toISOString(),
    items,
    bundleUrl: `/api/production-batches/${batch.id}/bundle`,
  };
}
