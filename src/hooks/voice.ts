"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { apiGet, apiPost } from "@/lib/api-client";
import type {
  ProviderId,
  ProviderStatus,
  VoiceModel,
  VoiceSummary,
} from "@/providers/voice/types";
import type { AppConfig } from "@/server/app-config";

export interface ProvidersResponse {
  providers: ProviderStatus[];
  config: AppConfig;
}

export function useProviders() {
  return useQuery({
    queryKey: ["providers"],
    queryFn: () => apiGet<ProvidersResponse>("/api/providers"),
  });
}

export function useVoices(providerId: ProviderId | undefined, query: string) {
  return useQuery({
    queryKey: ["voices", providerId, query],
    enabled: Boolean(providerId),
    queryFn: () =>
      apiGet<{ voices: VoiceSummary[] }>(
        `/api/providers/${providerId}/voices${
          query ? `?q=${encodeURIComponent(query)}` : ""
        }`,
      ).then((r) => r.voices),
  });
}

export function useModels(providerId: ProviderId | undefined) {
  return useQuery({
    queryKey: ["models", providerId],
    enabled: Boolean(providerId),
    queryFn: () =>
      apiGet<{ models: VoiceModel[] }>(
        `/api/providers/${providerId}/models`,
      ).then((r) => r.models),
  });
}

interface SaveKeyResponse {
  status: Record<ProviderId, boolean>;
  verified?: boolean;
  voiceCount?: number;
  verifyError?: string;
  cleared?: boolean;
}

export function useSaveKey() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { providerId: ProviderId; apiKey: string }) =>
      apiPost<SaveKeyResponse>("/api/settings/keys", vars),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["providers"] });
      qc.invalidateQueries({ queryKey: ["voices"] });
      qc.invalidateQueries({ queryKey: ["models"] });
    },
  });
}

export function useSetDefaults() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: {
      defaultProviderId?: ProviderId;
      modelFor?: ProviderId;
      modelId?: string;
    }) => apiPost<{ config: AppConfig }>("/api/settings/defaults", vars),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["providers"] }),
  });
}
