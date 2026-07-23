"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { apiDelete, apiGet, apiPatch, apiPost } from "@/lib/api-client";
import type {
  PodcastDTO,
  PodcastGenderDTO,
  PodcastLengthDTO,
  PodcastSummaryDTO,
  PodcastTakeDTO,
} from "@/lib/dto";
import type { PodcastPlan } from "@/library/podcast-schemas";
import type { AIProviderId } from "@/providers/ai/types";
import type { VoiceJobStatus } from "@/lib/voice-queue";

async function apiPut<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) throw new Error((json.error as string) || `HTTP ${res.status}`);
  return json as T;
}

function invalidatePodcast(
  qc: ReturnType<typeof useQueryClient>,
  id?: string,
) {
  void qc.invalidateQueries({ queryKey: ["podcasts"] });
  if (id) void qc.invalidateQueries({ queryKey: ["podcast", id] });
}

export function usePodcasts() {
  return useQuery({
    queryKey: ["podcasts"],
    queryFn: () =>
      apiGet<{ podcasts: PodcastSummaryDTO[] }>("/api/podcasts").then(
        (r) => r.podcasts,
      ),
  });
}

export function usePodcast(id: string) {
  return useQuery({
    queryKey: ["podcast", id],
    enabled: Boolean(id),
    queryFn: () =>
      apiGet<{ podcast: PodcastDTO }>(`/api/podcasts/${id}`).then(
        (r) => r.podcast,
      ),
  });
}

export function useCreatePodcast() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars?: {
      title?: string;
      description?: string;
      length?: PodcastLengthDTO;
    }) => apiPost<PodcastDTO>("/api/podcasts", vars ?? {}),
    onSuccess: () => invalidatePodcast(qc),
  });
}

export function useUpdatePodcast(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: {
      title?: string;
      description?: string;
      length?: PodcastLengthDTO;
    }) =>
      apiPatch<{ podcast: PodcastDTO }>(`/api/podcasts/${id}`, vars).then(
        (r) => r.podcast,
      ),
    onSuccess: () => invalidatePodcast(qc, id),
  });
}

export function useDeletePodcast() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (podcastId: string) =>
      apiDelete<{ ok: boolean }>(`/api/podcasts/${podcastId}`),
    onSuccess: () => invalidatePodcast(qc),
  });
}

export function useReplaceCharacters(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (characters: {
      id?: string;
      key?: string;
      name: string;
      gender: PodcastGenderDTO;
      definition?: string;
      providerId?: string;
      voiceId?: string;
      modelId?: string | null;
    }[]) =>
      apiPut<{ podcast: PodcastDTO }>(`/api/podcasts/${id}/characters`, {
        characters,
      }).then((r) => r.podcast),
    onSuccess: () => invalidatePodcast(qc, id),
  });
}

export function useUpdateCharacterVoices(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (
      updates: {
        id: string;
        providerId?: string;
        voiceId?: string;
        modelId?: string | null;
        name?: string;
        gender?: PodcastGenderDTO;
        definition?: string;
      }[],
    ) =>
      apiPatch<{ podcast: PodcastDTO }>(`/api/podcasts/${id}/characters`, {
        updates,
      }).then((r) => r.podcast),
    onSuccess: () => invalidatePodcast(qc, id),
  });
}

export function useGeneratePodcastScript(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: {
      providerId: AIProviderId;
      modelId?: string;
      brief: string;
      length?: PodcastLengthDTO;
      updateMeta?: boolean;
    }) =>
      apiPost<{ podcast: PodcastDTO; plan: PodcastPlan }>(
        `/api/podcasts/${id}/ai`,
        vars,
      ),
    onSuccess: () => invalidatePodcast(qc, id),
  });
}

export function useImportPodcastScript(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { plan: PodcastPlan; updateMeta?: boolean }) =>
      apiPost<{ podcast: PodcastDTO }>(`/api/podcasts/${id}/turns`, vars).then(
        (r) => r.podcast,
      ),
    onSuccess: () => invalidatePodcast(qc, id),
  });
}

export function useUpdatePodcastTurn(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { turnId: string; text: string }) =>
      apiPatch<{ podcast: PodcastDTO }>(`/api/podcasts/${id}/turns`, vars).then(
        (r) => r.podcast,
      ),
    onSuccess: () => invalidatePodcast(qc, id),
  });
}

export function useInsertPodcastTurn(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: {
      characterId: string;
      text: string;
      afterTurnId?: string | null;
    }) =>
      apiPost<{ podcast: PodcastDTO }>(`/api/podcasts/${id}/turns`, vars).then(
        (r) => r.podcast,
      ),
    onSuccess: () => invalidatePodcast(qc, id),
  });
}

export function useDeletePodcastTurn(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (turnId: string) => {
      const res = await fetch(`/api/podcasts/${id}/turns`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ turnId }),
      });
      const json = (await res.json().catch(() => ({}))) as {
        podcast?: PodcastDTO;
        error?: string;
      };
      if (!res.ok) throw new Error(json.error || `HTTP ${res.status}`);
      return json.podcast!;
    },
    onSuccess: () => invalidatePodcast(qc, id),
  });
}

export type PodcastGenerationProgress = {
  status: VoiceJobStatus;
  scene: number;
  sceneCount: number;
  workingOn?: number | null;
};

type PodcastJobPayload = PodcastGenerationProgress & {
  error: string | null;
  podcastTake: PodcastTakeDTO | null;
};

function applyPayload(
  data: PodcastJobPayload,
  onProgress?: (p: PodcastGenerationProgress) => void,
): "done" | "error" | "pending" {
  onProgress?.(data);
  if (data.status === "done" && data.podcastTake) return "done";
  if (data.status === "error") return "error";
  return "pending";
}

async function pollPodcastJob(
  podcastId: string,
  jobId: string,
  onProgress?: (p: PodcastGenerationProgress) => void,
): Promise<PodcastTakeDTO> {
  const started = Date.now();
  const maxMs = 20 * 60 * 1000;
  while (Date.now() - started < maxMs) {
    await new Promise((r) => setTimeout(r, 2000));
    const { job } = await apiGet<{
      job: {
        status: VoiceJobStatus;
        scene: number;
        sceneCount: number;
        workingOn?: number | null;
        error: string | null;
        podcastTake: PodcastTakeDTO | null;
      };
    }>(`/api/podcasts/${podcastId}/takes/${jobId}`);
    const outcome = applyPayload(
      {
        status: job.status,
        scene: job.scene,
        sceneCount: job.sceneCount,
        workingOn: job.workingOn ?? null,
        error: job.error,
        podcastTake: job.podcastTake,
      },
      onProgress,
    );
    if (outcome === "done" && job.podcastTake) return job.podcastTake;
    if (outcome === "error") {
      throw new Error(job.error || "Podcast generation failed");
    }
  }
  throw new Error("Podcast generation timed out after 20 minutes");
}

function waitForPodcastJob(
  podcastId: string,
  jobId: string,
  onProgress?: (p: PodcastGenerationProgress) => void,
): Promise<PodcastTakeDTO> {
  return new Promise((resolve, reject) => {
    let settled = false;
    let polling = false;
    const es = new EventSource(
      `/api/podcasts/${podcastId}/takes/${jobId}/progress`,
    );

    const finish = (fn: () => void) => {
      if (settled) return;
      settled = true;
      es.close();
      fn();
    };

    es.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data as string) as PodcastJobPayload;
        const outcome = applyPayload(data, onProgress);
        if (outcome === "done" && data.podcastTake) {
          finish(() => resolve(data.podcastTake!));
        } else if (outcome === "error") {
          finish(() =>
            reject(new Error(data.error || "Podcast generation failed")),
          );
        }
      } catch {
        /* ignore */
      }
    };

    es.onerror = () => {
      if (settled || polling) return;
      polling = true;
      es.close();
      void pollPodcastJob(podcastId, jobId, onProgress).then(
        (take) => finish(() => resolve(take)),
        (err) => finish(() => reject(err)),
      );
    };
  });
}

export function useGeneratePodcastTake(podcastId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars?: {
      onProgress?: (p: PodcastGenerationProgress) => void;
    }) =>
      apiPost<{ jobId: string }>(
        `/api/podcasts/${podcastId}/takes`,
        {},
      ).then(({ jobId }) =>
        waitForPodcastJob(podcastId, jobId, vars?.onProgress),
      ),
    onSuccess: () => invalidatePodcast(qc, podcastId),
  });
}

export function useDeletePodcastTake(podcastId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (takeId: string) =>
      apiDelete<{ ok: boolean }>(`/api/podcast-takes/${takeId}`),
    onSuccess: () => invalidatePodcast(qc, podcastId),
  });
}
