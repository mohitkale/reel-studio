"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";

import { apiGet, apiPost } from "@/lib/api-client";
import type { SceneVoiceClipDTO, ScriptDTO, VoiceTakeDTO } from "@/lib/dto";
import type { ProviderId } from "@/providers/voice/types";
import type { VoiceGenerationProgress } from "@/hooks/script";

async function apiSend<T>(
  url: string,
  method: "PATCH" | "DELETE",
  body?: unknown,
): Promise<T> {
  const res = await fetch(url, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) throw new Error((json.error as string) || `HTTP ${res.status}`);
  return json as T;
}

export interface SceneClipJobResult {
  take: VoiceTakeDTO | null;
  clip: SceneVoiceClipDTO | null;
  clips: SceneVoiceClipDTO[] | null;
}

type SceneClipJobPayload = VoiceGenerationProgress & {
  error: string | null;
  take: VoiceTakeDTO | null;
  clip: SceneVoiceClipDTO | null;
  clips: SceneVoiceClipDTO[] | null;
};

function applyJobPayload(
  data: SceneClipJobPayload,
  onProgress?: (progress: VoiceGenerationProgress) => void,
): "done" | "error" | "pending" {
  onProgress?.(data);
  if (data.status === "done") return "done";
  if (data.status === "error") return "error";
  return "pending";
}

async function pollSceneClipJob(
  scriptId: string,
  jobId: string,
  onProgress?: (progress: VoiceGenerationProgress) => void,
): Promise<SceneClipJobResult> {
  const started = Date.now();
  const maxMs = 20 * 60 * 1000;

  while (Date.now() - started < maxMs) {
    await new Promise((r) => setTimeout(r, 2000));
    try {
      const { job } = await apiGet<{
        job: {
          status: VoiceGenerationProgress["status"];
          scene: number;
          sceneCount: number;
          workingOn?: number | null;
          error: string | null;
          take: VoiceTakeDTO | null;
          clip: SceneVoiceClipDTO | null;
          clips: SceneVoiceClipDTO[] | null;
        };
      }>(`/api/scripts/${scriptId}/scene-clips/${jobId}`);

      const outcome = applyJobPayload(
        {
          status: job.status,
          scene: job.scene,
          sceneCount: job.sceneCount,
          workingOn: job.workingOn ?? null,
          error: job.error,
          take: job.take,
          clip: job.clip,
          clips: job.clips,
        },
        onProgress,
      );
      if (outcome === "done") {
        return { take: job.take, clip: job.clip, clips: job.clips };
      }
      if (outcome === "error") {
        throw new Error(job.error || "Scene voice generation failed");
      }
    } catch (e) {
      if (
        e instanceof Error &&
        e.message !== "Job not found" &&
        !e.message.includes("Scene voice generation failed")
      ) {
        continue;
      }
      throw e;
    }
  }

  throw new Error(
    "Scene voice generation is still running after 20 minutes. Refresh and check clips.",
  );
}

function waitForSceneClipJob(
  scriptId: string,
  jobId: string,
  onProgress?: (progress: VoiceGenerationProgress) => void,
): Promise<SceneClipJobResult> {
  return new Promise<SceneClipJobResult>((resolve, reject) => {
    let settled = false;
    let polling = false;
    const es = new EventSource(
      `/api/scripts/${scriptId}/scene-clips/${jobId}/progress`,
    );

    const finish = (fn: () => void) => {
      if (settled) return;
      settled = true;
      es.close();
      fn();
    };

    es.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data as string) as SceneClipJobPayload;
        const outcome = applyJobPayload(data, onProgress);
        if (outcome === "done") {
          finish(() =>
            resolve({
              take: data.take,
              clip: data.clip,
              clips: data.clips,
            }),
          );
        } else if (outcome === "error") {
          finish(() =>
            reject(new Error(data.error || "Scene voice generation failed")),
          );
        }
      } catch {
        // ignore malformed/heartbeat
      }
    };

    es.onerror = () => {
      if (settled || polling) return;
      polling = true;
      es.close();
      void pollSceneClipJob(scriptId, jobId, onProgress).then(
        (result) => finish(() => resolve(result)),
        (err) => finish(() => reject(err)),
      );
    };
  });
}

function useScriptInvalidator(scriptId: string) {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: ["script", scriptId] });
}

/** Generate clips for all scenes in parallel, then assemble. */
export function useGenerateAllSceneClips(scriptId: string) {
  const invalidate = useScriptInvalidator(scriptId);
  return useMutation({
    mutationFn: ({
      onProgress,
      ...body
    }: {
      placeholder?: boolean;
      providerId?: ProviderId;
      voiceId?: string;
      modelId?: string;
      label?: string;
      onProgress?: (progress: VoiceGenerationProgress) => void;
    }) =>
      apiPost<{ jobId: string }>(
        `/api/scripts/${scriptId}/scene-clips`,
        body,
      ).then(({ jobId }) => waitForSceneClipJob(scriptId, jobId, onProgress)),
    onSuccess: invalidate,
  });
}

/** Generate one scene clip (job polled via script-level scene-clips progress). */
export function useGenerateSceneClip(scriptId: string) {
  const invalidate = useScriptInvalidator(scriptId);
  return useMutation({
    mutationFn: ({
      sceneId,
      onProgress,
      ...body
    }: {
      sceneId: string;
      placeholder?: boolean;
      providerId?: ProviderId;
      voiceId?: string;
      modelId?: string;
      label?: string;
      onProgress?: (progress: VoiceGenerationProgress) => void;
    }) =>
      apiPost<{ jobId: string }>(`/api/scenes/${sceneId}/clips`, body).then(
        ({ jobId }) => waitForSceneClipJob(scriptId, jobId, onProgress),
      ),
    onSuccess: invalidate,
  });
}

export function useAssembleSceneClips(scriptId: string) {
  const invalidate = useScriptInvalidator(scriptId);
  return useMutation({
    mutationFn: () =>
      apiPost<{ take: VoiceTakeDTO }>(
        `/api/scripts/${scriptId}/scene-clips/assemble`,
        {},
      ).then((r) => r.take),
    onSuccess: invalidate,
  });
}

export function useDeleteSceneClip(scriptId: string) {
  const invalidate = useScriptInvalidator(scriptId);
  return useMutation({
    mutationFn: (id: string) => apiSend(`/api/scene-clips/${id}`, "DELETE"),
    onSuccess: invalidate,
  });
}

/** Select a clip on a scene; server may return an assembled take. */
export function useSelectSceneClip(scriptId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { sceneId: string; clipId: string }) =>
      apiSend<{ scene: ScriptDTO["scenes"][number]; take?: VoiceTakeDTO | null }>(
        `/api/scenes/${vars.sceneId}`,
        "PATCH",
        { selectedVoiceClipId: vars.clipId },
      ),
    onSuccess: (data) => {
      const prev = qc.getQueryData<ScriptDTO>(["script", scriptId]);
      if (!prev) return;
      qc.setQueryData<ScriptDTO>(["script", scriptId], {
        ...prev,
        scenes: prev.scenes.map((s) =>
          s.id === data.scene.id ? data.scene : s,
        ),
        takes: data.take
          ? [data.take, ...prev.takes.filter((t) => t.id !== data.take!.id)]
          : prev.takes,
      });
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ["script", scriptId] }),
  });
}
