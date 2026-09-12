"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { apiDelete, apiGet, apiPost } from "@/lib/api-client";
import type { McpScope, McpProviderId } from "@/production/mcp-access";

interface McpTokenState {
  configured: boolean;
  token: string | null;
}

const KEY = ["mcp-token"];
const NAMED_KEY = ["mcp-named-tokens"];

export interface NamedMcpToken {
  id: string;
  name: string;
  scopes: McpScope[];
  allowedProviders: McpProviderId[];
  paidProviders: McpProviderId[];
  maxDurationSeconds: number;
  maxBatchSize: number;
  paidRequestLimit: number;
  paidRequestsUsed: number;
  createdAt: string;
  lastUsedAt: string | null;
}

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
    onSuccess: (data) =>
      qc.setQueryData(KEY, { configured: data.configured, token: null }),
  });
}

export function useRevokeMcpToken() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => apiDelete<McpTokenState>("/api/settings/mcp-token"),
    onSuccess: (data) =>
      qc.setQueryData(KEY, { configured: data.configured, token: null }),
  });
}

export function useNamedMcpTokens() {
  return useQuery({
    queryKey: NAMED_KEY,
    queryFn: () =>
      apiGet<{ tokens: NamedMcpToken[] }>("/api/settings/mcp-tokens"),
  });
}

export function useCreateNamedMcpToken() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      name: string;
      policy: Omit<
        NamedMcpToken,
        "id" | "name" | "paidRequestsUsed" | "createdAt" | "lastUsedAt"
      >;
    }) =>
      apiPost<{ token: string; record: NamedMcpToken }>(
        "/api/settings/mcp-tokens",
        input,
      ),
    onSuccess: () => qc.invalidateQueries({ queryKey: NAMED_KEY }),
  });
}

export function useRevokeNamedMcpToken() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiDelete<{ revoked: true }>(`/api/settings/mcp-tokens/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: NAMED_KEY }),
  });
}
