"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { apiGet, apiPost } from "@/lib/api-client";
import type {
  AIModel,
  AIProviderId,
  AIProviderStatus,
  ScriptStyle,
} from "@/providers/ai/types";
import type { Orientation } from "@/lib/orientation";
import type { VideoEngineId } from "@/engines/types";

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
    }) =>
      apiPost<{ projectId: string; scriptId: string }>(
        "/api/projects/ai",
        vars,
      ),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["projects"] }),
  });
}
