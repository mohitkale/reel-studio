"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { apiGet, apiPost } from "@/lib/api-client";
import type {
  ProjectDTO,
  ScriptDTO,
  SceneDTO,
  SceneBackground,
  VoiceTakeDTO,
} from "@/lib/dto";
import type { ProviderId } from "@/providers/voice/types";
import type { Orientation } from "@/lib/orientation";

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
    mutationFn: (vars: { name: string; orientation?: Orientation }) =>
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
      templateId?: string;
      emphasis?: string[];
      visual?: string | null;
      background?: SceneBackground | null;
      items?: string[] | null;
      hideText?: boolean | null;
    }) => apiSend(`/api/scenes/${vars.id}`, "PATCH", vars),
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

export function useGenerateTake(scriptId: string) {
  const invalidate = useScriptInvalidator(scriptId);
  return useMutation({
    mutationFn: (vars: {
      placeholder?: boolean;
      providerId?: ProviderId;
      voiceId?: string;
      modelId?: string;
      label?: string;
    }) =>
      apiPost<{ take: VoiceTakeDTO }>(`/api/scripts/${scriptId}/takes`, vars).then(
        (r) => r.take,
      ),
    onSuccess: invalidate,
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
      emphasis: string[];
      visual: string | null;
      background?: SceneBackground | null;
      items?: string[];
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
      emphasis: string[];
      visual: string | null;
      background?: SceneBackground | null;
      items?: string[];
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
