"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { apiGet, apiPost } from "@/lib/api-client";
import type { ProjectDTO, ScriptDTO, SceneDTO, VoiceTakeDTO } from "@/lib/dto";
import type { ProviderId } from "@/providers/voice/types";

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
    mutationFn: (name: string) =>
      apiPost<{ projectId: string; scriptId: string }>("/api/projects", { name }),
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

export function useUndoScript(scriptId: string) {
  const invalidate = useScriptInvalidator(scriptId);
  return useMutation({
    mutationFn: (scenes: {
      templateId: string | null;
      text: string;
      emphasis: string[];
      visual: string | null;
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
