"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { apiGet, apiPost } from "@/lib/api-client";
import type {
  ProjectDTO,
  ScriptDTO,
  SceneDTO,
  SceneBackground,
  VoiceTakeDTO,
  VoiceMode,
} from "@/lib/dto";
import type { ProviderId } from "@/providers/voice/types";
import type { Orientation } from "@/lib/orientation";
import type { VideoEngineId } from "@/engines/types";
import type { ScriptStyle } from "@/providers/ai/types";
import type { EnergyId, StyleId } from "@/compositions/visual-style";

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

/* Projects */

export function useProjects() {
  return useQuery({
    queryKey: ["projects"],
    queryFn: () =>
      apiGet<{ projects: ProjectDTO[] }>("/api/projects").then((r) => r.projects),
  });
}

export function useCreateProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: {
      name: string;
      orientation?: Orientation;
      videoEngine?: VideoEngineId;
    }) =>
      apiPost<{ projectId: string; scriptId: string }>("/api/projects", vars),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["projects"] }),
  });
}

export function useDeleteProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiSend(`/api/projects/${id}`, "DELETE"),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["projects"] }),
  });
}

/* Script (with scenes + takes) */

export function useScript(scriptId: string) {
  return useQuery({
    queryKey: ["script", scriptId],
    queryFn: () =>
      apiGet<{ script: ScriptDTO }>(`/api/scripts/${scriptId}`).then(
        (r) => r.script,
      ),
  });
}

function useScriptInvalidator(scriptId: string) {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: ["script", scriptId] });
}

/** Set or clear the reel's cover image (baked as the opening frame at render). */
export function useSetScriptCover(scriptId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (coverUrl: string | null) =>
      apiSend(`/api/scripts/${scriptId}`, "PATCH", { coverUrl }),
    onMutate: async (coverUrl) => {
      await qc.cancelQueries({ queryKey: ["script", scriptId] });
      const prev = qc.getQueryData<ScriptDTO>(["script", scriptId]);
      if (prev) qc.setQueryData<ScriptDTO>(["script", scriptId], { ...prev, coverUrl });
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(["script", scriptId], ctx.prev);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ["script", scriptId] }),
  });
}

/** Set/clear the reel's background music track and/or its volume (0-100). */
export function useSetScriptMusic(scriptId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { musicUrl?: string | null; musicVolume?: number }) =>
      apiSend(`/api/scripts/${scriptId}`, "PATCH", vars),
    onMutate: async (vars) => {
      await qc.cancelQueries({ queryKey: ["script", scriptId] });
      const prev = qc.getQueryData<ScriptDTO>(["script", scriptId]);
      if (prev) {
        qc.setQueryData<ScriptDTO>(["script", scriptId], {
          ...prev,
          ...(vars.musicUrl !== undefined ? { musicUrl: vars.musicUrl } : {}),
          ...(vars.musicVolume !== undefined
            ? { musicVolume: vars.musicVolume }
            : {}),
        });
      }
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(["script", scriptId], ctx.prev);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ["script", scriptId] }),
  });
}

/** Update whole-reel Style and/or Energy (live preview). */
export function useSetScriptVisualStyle(scriptId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { styleId?: StyleId; energy?: EnergyId }) =>
      apiSend(`/api/scripts/${scriptId}`, "PATCH", vars),
    onMutate: async (vars) => {
      await qc.cancelQueries({ queryKey: ["script", scriptId] });
      const prev = qc.getQueryData<ScriptDTO>(["script", scriptId]);
      if (prev) {
        qc.setQueryData<ScriptDTO>(["script", scriptId], {
          ...prev,
          ...(vars.styleId !== undefined ? { styleId: vars.styleId } : {}),
          ...(vars.energy !== undefined ? { energy: vars.energy } : {}),
        });
      }
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(["script", scriptId], ctx.prev);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ["script", scriptId] }),
  });
}

/** Toggle the script-wide default for hiding the top progress bar. */
export function useSetScriptHideProgressBar(scriptId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (hideProgressBar: boolean) =>
      apiSend(`/api/scripts/${scriptId}`, "PATCH", { hideProgressBar }),
    onMutate: async (hideProgressBar) => {
      await qc.cancelQueries({ queryKey: ["script", scriptId] });
      const prev = qc.getQueryData<ScriptDTO>(["script", scriptId]);
      if (prev) qc.setQueryData<ScriptDTO>(["script", scriptId], { ...prev, hideProgressBar });
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(["script", scriptId], ctx.prev);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ["script", scriptId] }),
  });
}

/** Toggle the script-wide default for hiding on-screen scene text. */
export function useSetScriptHideText(scriptId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (hideText: boolean) =>
      apiSend(`/api/scripts/${scriptId}`, "PATCH", { hideText }),
    onMutate: async (hideText) => {
      await qc.cancelQueries({ queryKey: ["script", scriptId] });
      const prev = qc.getQueryData<ScriptDTO>(["script", scriptId]);
      if (prev) qc.setQueryData<ScriptDTO>(["script", scriptId], { ...prev, hideText });
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(["script", scriptId], ctx.prev);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ["script", scriptId] }),
  });
}

/** Toggle voice workflow: oneshot (full take) vs per_scene (clip library). */
export function useSetVoiceMode(scriptId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (voiceMode: VoiceMode) =>
      apiSend(`/api/scripts/${scriptId}`, "PATCH", { voiceMode }),
    onMutate: async (voiceMode) => {
      await qc.cancelQueries({ queryKey: ["script", scriptId] });
      const prev = qc.getQueryData<ScriptDTO>(["script", scriptId]);
      if (prev) qc.setQueryData<ScriptDTO>(["script", scriptId], { ...prev, voiceMode });
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(["script", scriptId], ctx.prev);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ["script", scriptId] }),
  });
}

/* Scenes */

export function useAddScene(scriptId: string) {
  const invalidate = useScriptInvalidator(scriptId);
  return useMutation({
    mutationFn: (text: string) =>
      apiPost<{ scene: SceneDTO }>(`/api/scripts/${scriptId}/scenes`, { text }),
    onSuccess: invalidate,
  });
}

export function useUpdateScene(scriptId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: {
      id: string;
      text?: string;
      spokenText?: string | null;
      templateId?: string;
      emphasis?: string[];
      visual?: string | null;
      background?: SceneBackground | null;
      items?: string[] | null;
      hideText?: boolean | null;
      mood?: string | null;
      musicMood?: string | null;
      selectedVoiceClipId?: string | null;
    }) =>
      apiSend<{ scene: SceneDTO; take?: VoiceTakeDTO | null }>(
        `/api/scenes/${vars.id}`,
        "PATCH",
        vars,
      ),
    // Optimistic: reflect the edit in the preview instantly, before the server.
    onMutate: async (vars) => {
      await qc.cancelQueries({ queryKey: ["script", scriptId] });
      const prev = qc.getQueryData<ScriptDTO>(["script", scriptId]);
      if (prev) {
        qc.setQueryData<ScriptDTO>(["script", scriptId], {
          ...prev,
          scenes: prev.scenes.map((s) =>
            s.id === vars.id
              ? {
                  ...s,
                  ...(vars.text !== undefined ? { text: vars.text } : {}),
                  ...(vars.spokenText !== undefined
                    ? { spokenText: vars.spokenText }
                    : {}),
                  ...(vars.templateId !== undefined
                    ? { templateId: vars.templateId }
                    : {}),
                  ...(vars.emphasis !== undefined
                    ? { emphasis: vars.emphasis }
                    : {}),
                  ...(vars.visual !== undefined
                    ? { visual: vars.visual ?? undefined }
                    : {}),
                  ...(vars.background !== undefined
                    ? { background: vars.background ?? undefined }
                    : {}),
                  ...(vars.items !== undefined
                    ? { items: vars.items ?? undefined }
                    : {}),
                  ...(vars.hideText !== undefined
                    ? { hideText: vars.hideText }
                    : {}),
                  ...(vars.selectedVoiceClipId !== undefined
                    ? { selectedVoiceClipId: vars.selectedVoiceClipId }
                    : {}),
                }
              : s,
          ),
        });
      }
      return { prev };
    },
    onError: (_e, _vars, ctx) => {
      if (ctx?.prev) qc.setQueryData(["script", scriptId], ctx.prev);
    },
    onSuccess: (data) => {
      if (data.take) {
        const prev = qc.getQueryData<ScriptDTO>(["script", scriptId]);
        if (prev) {
          qc.setQueryData<ScriptDTO>(["script", scriptId], {
            ...prev,
            takes: [data.take!, ...prev.takes.filter((t) => t.id !== data.take!.id)],
          });
        }
      }
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ["script", scriptId] }),
  });
}

export function useDeleteScene(scriptId: string) {
  const invalidate = useScriptInvalidator(scriptId);
  return useMutation({
    mutationFn: (id: string) => apiSend(`/api/scenes/${id}`, "DELETE"),
    onSuccess: invalidate,
  });
}

export function useReorderScenes(scriptId: string) {
  const invalidate = useScriptInvalidator(scriptId);
  return useMutation({
    mutationFn: (orderedIds: string[]) =>
      apiSend(`/api/scripts/${scriptId}/scenes`, "PATCH", { orderedIds }),
    onSuccess: invalidate,
  });
}

/* Takes */

export interface VoiceGenerationProgress {
  status: "queued" | "synthesizing" | "stitching" | "done" | "error";
  scene: number;
  sceneCount: number;
  /** 1-based scene index currently being synthesized (VoiceForge can take minutes). */
  workingOn?: number | null;
}

/**
 * Kicks off server-side voice generation (POST returns a jobId immediately),
 * then follows its SSE progress stream until it resolves with the finished
 * take or rejects with the job's error. Pass `onProgress` in the mutation
 * variables to drive a live "scene N/M" indicator in the UI.
 *
 * If the EventSource drops (common on long VoiceForge CPU jobs), we fall back
 * to polling the JSON job endpoint instead of failing immediately.
 */
export function useGenerateTake(scriptId: string) {
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
      apiPost<{ jobId: string }>(`/api/scripts/${scriptId}/takes`, body).then(
        ({ jobId }) => waitForVoiceJob(scriptId, jobId, onProgress),
      ),
    onSuccess: invalidate,
  });
}

type VoiceJobPayload = VoiceGenerationProgress & {
  error: string | null;
  take: VoiceTakeDTO | null;
};

function applyVoiceJobPayload(
  data: VoiceJobPayload,
  onProgress?: (progress: VoiceGenerationProgress) => void,
): "done" | "error" | "pending" {
  onProgress?.(data);
  if (data.status === "done" && data.take) return "done";
  if (data.status === "error") return "error";
  return "pending";
}

async function pollVoiceJob(
  scriptId: string,
  jobId: string,
  onProgress?: (progress: VoiceGenerationProgress) => void,
): Promise<VoiceTakeDTO> {
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
        };
      }>(`/api/scripts/${scriptId}/takes/${jobId}`);

      const outcome = applyVoiceJobPayload(
        {
          status: job.status,
          scene: job.scene,
          sceneCount: job.sceneCount,
          workingOn: job.workingOn ?? null,
          error: job.error,
          take: job.take,
        },
        onProgress,
      );
      if (outcome === "done" && job.take) return job.take;
      if (outcome === "error") {
        throw new Error(job.error || "Voice generation failed");
      }
    } catch (e) {
      if (e instanceof Error && e.message !== "Job not found" && !e.message.includes("Voice generation failed")) {
        // Transient network blip while VoiceForge is still working — keep polling.
        continue;
      }
      throw e;
    }
  }

  throw new Error(
    "Voice generation is still running after 20 minutes. Check VoiceForge logs/CPU, then refresh Takes.",
  );
}

function waitForVoiceJob(
  scriptId: string,
  jobId: string,
  onProgress?: (progress: VoiceGenerationProgress) => void,
): Promise<VoiceTakeDTO> {
  return new Promise<VoiceTakeDTO>((resolve, reject) => {
    let settled = false;
    let polling = false;
    const es = new EventSource(
      `/api/scripts/${scriptId}/takes/${jobId}/progress`,
    );

    const finish = (fn: () => void) => {
      if (settled) return;
      settled = true;
      es.close();
      fn();
    };

    es.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data as string) as VoiceJobPayload;
        const outcome = applyVoiceJobPayload(data, onProgress);
        if (outcome === "done" && data.take) {
          finish(() => resolve(data.take!));
        } else if (outcome === "error") {
          finish(() =>
            reject(new Error(data.error || "Voice generation failed")),
          );
        }
      } catch {
        // ignore malformed/heartbeat messages, keep listening
      }
    };

    es.onerror = () => {
      if (settled || polling) return;
      polling = true;
      es.close();
      // Long VoiceForge jobs can drop SSE; poll instead of failing the take.
      void pollVoiceJob(scriptId, jobId, onProgress).then(
        (take) => finish(() => resolve(take)),
        (err) => finish(() => reject(err)),
      );
    };
  });
}

export function useEnhanceScript(scriptId: string) {
  const invalidate = useScriptInvalidator(scriptId);
  return useMutation({
    mutationFn: (vars: {
      providerId: string;
      mode: "rewrite" | "append";
      brief: string;
      sceneCount?: number;
      scriptStyle?: ScriptStyle;
    }) =>
      apiPost<{ script: ScriptDTO }>(`/api/scripts/${scriptId}/ai`, vars).then(
        (r) => r.script,
      ),
    onSuccess: invalidate,
  });
}

/**
 * Replace ALL scenes of a script in one shot from an external JSON payload.
 * Reuses the snapshot/undo endpoint, which deletes and recreates scenes in order.
 */
export function useImportScenes(scriptId: string) {
  const invalidate = useScriptInvalidator(scriptId);
  return useMutation({
    mutationFn: (scenes: {
      templateId: string | null;
      text: string;
      spokenText?: string | null;
      emphasis: string[];
      visual: string | null;
      background?: SceneBackground | null;
      items?: string[];
      mood?: string;
      musicMood?: string;
    }[]) =>
      apiPost<{ script: ScriptDTO }>(`/api/scripts/${scriptId}/undo`, { scenes }).then(
        (r) => r.script,
      ),
    onSuccess: invalidate,
  });
}

export function useUndoScript(scriptId: string) {
  const invalidate = useScriptInvalidator(scriptId);
  return useMutation({
    mutationFn: (scenes: {
      templateId: string | null;
      text: string;
      spokenText?: string | null;
      emphasis: string[];
      visual: string | null;
      background?: SceneBackground | null;
      items?: string[];
      mood?: string;
      musicMood?: string;
    }[]) =>
      apiPost<{ script: ScriptDTO }>(`/api/scripts/${scriptId}/undo`, { scenes }).then(
        (r) => r.script,
      ),
    onSuccess: invalidate,
  });
}

export function useDeleteTake(scriptId: string) {
  const invalidate = useScriptInvalidator(scriptId);
  return useMutation({
    mutationFn: (id: string) => apiSend(`/api/takes/${id}`, "DELETE"),
    onSuccess: invalidate,
  });
}
