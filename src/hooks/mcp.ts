"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { apiDelete, apiGet, apiPost } from "@/lib/api-client";

interface McpTokenState {
  configured: boolean;
  token: string | null;
}

const KEY = ["mcp-token"];

export function useMcpToken() {
  return useQuery({
    queryKey: KEY,
    queryFn: () => apiGet<McpTokenState>("/api/settings/mcp-token"),
  });
}

export function useGenerateMcpToken() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => apiPost<McpTokenState>("/api/settings/mcp-token", {}),
    onSuccess: (data) => qc.setQueryData(KEY, data),
  });
}

export function useRevokeMcpToken() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => apiDelete<McpTokenState>("/api/settings/mcp-token"),
    onSuccess: (data) => qc.setQueryData(KEY, data),
  });
}
