"use client";

import {
  useQuery,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import type { AssetDTO } from "@/lib/dto";

async function fetchAssets(type?: string): Promise<AssetDTO[]> {
  const url = type ? `/api/assets?type=${type}` : "/api/assets";
  const res = await fetch(url);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export function useAssets(type?: string) {
  return useQuery<AssetDTO[]>({
    queryKey: ["assets", type ?? "all"],
    queryFn: () => fetchAssets(type),
  });
}

export function useUploadAsset() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (formData: FormData) => {
      const res = await fetch("/api/assets", { method: "POST", body: formData });
      if (!res.ok) throw new Error(await res.text());
      return res.json() as Promise<AssetDTO>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["assets"] });
    },
  });
}

export function useDeleteAsset() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/assets/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error(await res.text());
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["assets"] });
    },
  });
}
