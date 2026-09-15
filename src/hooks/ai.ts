"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { apiGet, apiPost, apiPut } from "@/lib/api-client";
import type {
  AIModel,
  AIProviderId,
  AIProviderStatus,
  ScriptStyle,
} from "@/providers/ai/types";
import type { Orientation } from "@/lib/orientation";
import type { VideoEngineId } from "@/engines/types";
import type { ProductionPresetId } from "@/production/presets";
import type { EnergyId, StyleId } from "@/compositions/visual-style";
import type { MediaPreference } from "@/lib/media-preference";
import type { AutomaticMediaState } from "@/library/automatic-stock-media";
import type {
  LocalAIProviderConfigInput,
  LocalAIProviderId,
  LocalAIProviderView,
} from "@/providers/ai/local-types";

export function useAIProviders() {
  return useQuery({
    queryKey: ["ai-providers"],
    queryFn: () =>
      apiGet<{ providers: AIProviderStatus[] }>("/api/ai/providers").then(
        (r) => r.providers,
      ),
  });
}

export function useAIModels(providerId: AIProviderId | undefined) {
  return useQuery({
    queryKey: ["ai-models", providerId],
    enabled: Boolean(providerId),
    queryFn: () =>
      apiGet<{ models: AIModel[] }>(
        `/api/ai/providers/${providerId}/models`,
      ).then((r) => r.models),
  });
}

interface SaveAIKeyResponse {
  status: Record<AIProviderId, boolean>;
  verified?: boolean;
  modelCount?: number;
  verifyError?: string;
  cleared?: boolean;
}

export function useSaveAIKey() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { providerId: AIProviderId; apiKey: string }) =>
      apiPost<SaveAIKeyResponse>("/api/ai/keys", vars),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ai-providers"] });
      qc.invalidateQueries({ queryKey: ["ai-models"] });
    },
  });
}

export function useLocalAIProviders() {
  return useQuery({
    queryKey: ["local-ai-providers"],
    queryFn: () =>
      apiGet<{ providers: LocalAIProviderView[] }>("/api/ai/local-config").then(
        (response) => response.providers,
      ),
  });
}

export function useSaveLocalAIConfig() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      providerId: LocalAIProviderId;
      config: LocalAIProviderConfigInput;
    }) =>
      apiPost<{ provider: LocalAIProviderView }>("/api/ai/local-config", input),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["local-ai-providers"] }),
  });
}

export function useDiagnoseLocalAI() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (providerId: LocalAIProviderId) =>
      apiPut<{ diagnostic: LocalAIProviderView["diagnostic"] }>(
        "/api/ai/local-config",
        { providerId },
      ),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["local-ai-providers"] }),
  });
}

export function useGenerateProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: {
      providerId: AIProviderId;
      modelId?: string;
      mode: "idea" | "story";
      brief: string;
      sceneCount?: number;
      orientation?: Orientation;
      scriptStyle?: ScriptStyle;
      videoEngine?: VideoEngineId;
      styleId?: StyleId | "auto";
      energy?: EnergyId | "auto";
      productionPresetId?: ProductionPresetId;
      mediaPreference?: MediaPreference;
    }) =>
      apiPost<{
        projectId: string;
        scriptId: string;
        mediaDecisions: Array<{
          state: AutomaticMediaState;
          kind?: "image" | "video";
          providerId?: string;
          attemptedProviders: string[];
          message: string;
        }>;
      }>("/api/projects/ai", vars),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["projects"] }),
  });
}
