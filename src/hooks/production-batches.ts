"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { apiGet, apiPost } from "@/lib/api-client";
import type { ProductionJobView } from "@/hooks/production-jobs";

export interface ProductionBatchItemView {
  id: string;
  rowIndex: number;
  variantIndex: number;
  label: string | null;
  orientation: string | null;
  state: string;
  error: string | null;
  job: ProductionJobView | null;
}

export interface ProductionBatchView {
  id: string;
  state: string;
  progress: number;
  totalItems: number;
  succeededItems: number;
  failedItems: number;
  bundleUrl: string;
  createdAt: string;
  items: ProductionBatchItemView[];
}

const KEY = ["production-batches"];

export function useProductionBatches() {
  return useQuery({
    queryKey: KEY,
    queryFn: () =>
      apiGet<{ batches: ProductionBatchView[] }>(
        "/api/production-batches?limit=25",
      ),
    refetchInterval: (query) =>
      query.state.data?.batches.some((batch) =>
        ["queued", "running"].includes(batch.state),
      )
        ? 2_000
        : false,
  });
}

function useBatchAction(action: "approve" | "cancel" | "retry") {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiPost<{ batch: ProductionBatchView }>(
        `/api/production-batches/${id}/${action}`,
        {},
      ),
    onSuccess: async () => {
      await Promise.all([
        client.invalidateQueries({ queryKey: KEY }),
        client.invalidateQueries({ queryKey: ["production-jobs"] }),
      ]);
    },
  });
}

export function useApproveProductionBatch() {
  return useBatchAction("approve");
}

export function useCancelProductionBatch() {
  return useBatchAction("cancel");
}

export function useRetryProductionBatch() {
  return useBatchAction("retry");
}
