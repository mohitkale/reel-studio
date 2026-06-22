"use client";

import {
  useQuery,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import type { BrandKitDTO } from "@/lib/dto";

async function fetchBrandKits(): Promise<BrandKitDTO[]> {
  const res = await fetch("/api/brandkits");
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export function useBrandKits() {
  return useQuery<BrandKitDTO[]>({
    queryKey: ["brandkits"],
    queryFn: fetchBrandKits,
  });
}

export function useCreateBrandKit() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (name: string) => {
      const res = await fetch("/api/brandkits", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json() as Promise<BrandKitDTO>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["brandkits"] });
    },
  });
}

export function useUpdateBrandKit() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      ...patch
    }: { id: string; name?: string; handle?: string | null; palette?: Record<string, string>; fonts?: { fontFamily?: string } }) => {
      const res = await fetch(`/api/brandkits/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json() as Promise<BrandKitDTO>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["brandkits"] });
      queryClient.invalidateQueries({ queryKey: ["scripts"] });
    },
  });
}

export function useDeleteBrandKit() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/brandkits/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error(await res.text());
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["brandkits"] });
      queryClient.invalidateQueries({ queryKey: ["scripts"] });
    },
  });
}

export function useAssignBrandKit() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      projectId,
      brandKitId,
    }: {
      projectId: string;
      brandKitId: string | null;
    }) => {
      const res = await fetch(`/api/projects/${projectId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ brandKitId }),
      });
      if (!res.ok) throw new Error(await res.text());
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["scripts"] });
    },
  });
}
