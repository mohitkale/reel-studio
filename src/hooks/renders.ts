"use client";

import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { apiGet, apiPost, apiDelete } from "@/lib/api-client";
import type { RenderDTO } from "@/lib/dto";

export function useRenders(scriptId?: string) {
  const params = scriptId ? `?scriptId=${scriptId}` : "";
  return useQuery({
    queryKey: ["renders", scriptId ?? "all"],
    queryFn: () =>
      apiGet<{ renders: RenderDTO[] }>(`/api/renders${params}`).then(
        (r) => r.renders,
      ),
    refetchInterval: 5000, // poll as a fallback when SSE is not connected
  });
}

export function useCreateRender() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { scriptId: string; voiceTakeId?: string }) =>
      apiPost<{ render: RenderDTO }>("/api/renders", vars).then((r) => r.render),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["renders"] }),
  });
}

export function useDeleteRender() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiDelete<{ ok: boolean }>(`/api/renders/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["renders"] }),
  });
}

/** Subscribe to SSE progress for a single render job. */
export function useRenderProgress(
  renderId: string | null,
  onUpdate: (data: {
    progress: number;
    status: string;
    error: string | null;
    outputUrl: string | null;
  }) => void,
) {
  React.useEffect(() => {
    if (!renderId) return;
    const es = new EventSource(`/api/renders/${renderId}/progress`);
    es.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data as string) as {
          progress: number;
          status: string;
          error: string | null;
          outputUrl: string | null;
        };
        onUpdate(data);
        if (data.status === "done" || data.status === "error") es.close();
      } catch { /* ignore */ }
    };
    return () => es.close();
  }, [renderId, onUpdate]);
}
