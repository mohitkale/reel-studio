"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import type { SceneBackground, SceneDTO } from "@/lib/dto";
import { apiDelete, apiGet, apiPost } from "@/lib/api-client";
import type { StockMediaProviderDescriptor } from "@/providers/stock/registry";
import type {
  StockMediaProviderHealth,
  StockMediaSearchRequest,
  StockMediaSearchResponse,
  StockMediaSelectionDTO,
} from "@/providers/stock/schemas";

export interface StockMediaProviderView extends StockMediaProviderDescriptor {
  health: StockMediaProviderHealth;
}

export interface SelectStockMediaInput {
  providerId: string;
  providerAssetId: string;
  search: StockMediaSearchRequest;
  imageEffect?: NonNullable<SceneBackground["effect"]>;
}

export function useStockMediaProviders() {
  return useQuery({
    queryKey: ["stock-media-providers"],
    queryFn: () =>
      apiGet<{ providers: StockMediaProviderView[] }>(
        "/api/stock/providers",
      ).then((result) => result.providers),
    staleTime: 30_000,
  });
}

export function useSearchStockMedia() {
  return useMutation({
    mutationFn: (input: {
      providerId: string;
      request: StockMediaSearchRequest;
    }) => apiPost<StockMediaSearchResponse>("/api/stock/search", input),
  });
}

export function useSceneStockMediaSelection(sceneId: string) {
  return useQuery({
    queryKey: ["stock-media-selection", sceneId],
    queryFn: () =>
      apiGet<{ selection: StockMediaSelectionDTO | null }>(
        `/api/scenes/${sceneId}/stock-media`,
      ).then((result) => result.selection),
  });
}

export function useSelectSceneStockMedia(scriptId: string, sceneId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: SelectStockMediaInput) =>
      apiPost<{
        scene: SceneDTO;
        selection: StockMediaSelectionDTO;
        usageWarning?: string;
      }>(`/api/scenes/${sceneId}/stock-media`, input),
    onSuccess: async (result) => {
      queryClient.setQueryData(
        ["stock-media-selection", sceneId],
        result.selection,
      );
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["script", scriptId] }),
        queryClient.invalidateQueries({ queryKey: ["assets"] }),
      ]);
    },
  });
}

export function useClearSceneStockMedia(scriptId: string, sceneId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () =>
      apiDelete<{ scene: SceneDTO }>(`/api/scenes/${sceneId}/stock-media`),
    onSuccess: async () => {
      queryClient.setQueryData(["stock-media-selection", sceneId], null);
      await queryClient.invalidateQueries({ queryKey: ["script", scriptId] });
    },
  });
}
