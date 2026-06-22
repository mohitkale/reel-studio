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
  const invalidate = useScriptInvalidator(scriptId);
  return useMutation({
    mutationFn: (vars: {
      id: string;
      text?: string;
      templateId?: string;
      emphasis?: string[];
    }) => apiSend(`/api/scenes/${vars.id}`, "PATCH", vars),
    onSuccess: invalidate,
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
    }) =>
      apiPost<{ take: VoiceTakeDTO }>(`/api/scripts/${scriptId}/takes`, vars).then(
        (r) => r.take,
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
