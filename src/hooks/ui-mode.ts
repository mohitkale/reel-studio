"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import type { UiMode, UiState } from "@/server/ui-mode";
import { apiGet, apiPost } from "@/lib/api-client";

export type { UiMode };

const KEY = ["ui-mode"] as const;

/** Current Simple/Pro mode and first-run state. */
export function useUiState() {
  return useQuery({
    queryKey: KEY,
    queryFn: () => apiGet<UiState>("/api/ui-mode"),
    staleTime: 60_000,
  });
}

export function useUiMode(): { mode: UiMode; ready: boolean } {
  const { data } = useUiState();
  // Pro until loaded, so an existing workspace never flashes a reduced menu.
  return { mode: data?.mode ?? "pro", ready: Boolean(data) };
}

export function useSetUiMode() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: { mode?: UiMode; onboarded?: boolean }) =>
      apiPost<UiState>("/api/ui-mode", input),
    onSuccess: (state) => client.setQueryData(KEY, state),
  });
}
