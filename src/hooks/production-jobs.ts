"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { apiGet, apiPost } from "@/lib/api-client";

export interface ProductionJobOutputView {
  id: string;
  kind: string;
  format: string;
  downloadUrl: string;
}

export interface ProductionJobView {
  id: string;
  kind: string;
  state: string;
  progress: number;
  error: string | null;
  createdAt: string;
  outputs: ProductionJobOutputView[];
}

const KEY = ["production-jobs"];

export function useProductionJobs() {
  return useQuery({
    queryKey: KEY,
    queryFn: () =>
      apiGet<{ jobs: ProductionJobView[] }>("/api/production-jobs?limit=50"),
    refetchInterval: (query) =>
      query.state.data?.jobs.some((job) =>
        ["queued", "running"].includes(job.state),
      )
        ? 2_000
        : false,
  });
}

function action(path: string) {
  return apiPost<{ id: string; state: string }>(path, {});
}

export function useApproveProductionJob() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => action(`/api/production-jobs/${id}/approve`),
    onSuccess: () => client.invalidateQueries({ queryKey: KEY }),
  });
}

export function useCancelProductionJob() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => action(`/api/production-jobs/${id}/cancel`),
    onSuccess: () => client.invalidateQueries({ queryKey: KEY }),
  });
}

export function useRetryProductionJob() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => action(`/api/production-jobs/${id}/retry`),
    onSuccess: () => client.invalidateQueries({ queryKey: KEY }),
  });
}
