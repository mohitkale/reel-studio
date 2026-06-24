"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { apiGet, apiPost } from "@/lib/api-client";
import type { StockProviderId } from "@/providers/stock/types";

export interface StockProviderStatus {
  id: StockProviderId;
  label: string;
  configured: boolean;
}

const LABELS: Record<StockProviderId, string> = {
  unsplash: "Unsplash",
};

export function useStockProviders() {
  return useQuery({
    queryKey: ["stock-providers"],
    queryFn: () =>
      apiGet<{ status: Record<StockProviderId, boolean> }>("/api/stock/keys").then(
        (r) =>
          (Object.keys(r.status) as StockProviderId[]).map((id) => ({
            id,
            label: LABELS[id] ?? id,
            configured: r.status[id],
          })),
      ),
  });
}

interface SaveStockKeyResponse {
  status: Record<StockProviderId, boolean>;
  verified?: boolean;
  verifyError?: string;
  cleared?: boolean;
}

export function useSaveStockKey() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { providerId: StockProviderId; apiKey: string }) =>
      apiPost<SaveStockKeyResponse>("/api/stock/keys", vars),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["stock-providers"] }),
  });
}
