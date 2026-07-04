"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { apiGet, apiPost } from "@/lib/api-client";
import type { MusicProviderId, RemoteMusicTrack } from "@/providers/music/types";

export interface MusicProviderStatus {
  id: MusicProviderId;
  label: string;
  configured: boolean;
}

const LABELS: Record<MusicProviderId, string> = {
  jamendo: "Jamendo",
};

export function useMusicProviders() {
  return useQuery({
    queryKey: ["music-providers"],
    queryFn: () =>
      apiGet<{ status: Record<MusicProviderId, boolean> }>("/api/music/keys").then(
        (r) =>
          (Object.keys(r.status) as MusicProviderId[]).map((id) => ({
            id,
            label: LABELS[id] ?? id,
            configured: r.status[id],
          })),
      ),
  });
}

interface SaveMusicKeyResponse {
  status: Record<MusicProviderId, boolean>;
  verified?: boolean;
  verifyError?: string;
  cleared?: boolean;
}

export function useSaveMusicKey() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { providerId: MusicProviderId; apiKey: string }) =>
      apiPost<SaveMusicKeyResponse>("/api/music/keys", vars),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["music-providers"] }),
  });
}

/** Search the configured external music provider for tracks matching a mood/vibe query. */
export function useSearchMusic(query: string, enabled: boolean) {
  return useQuery({
    queryKey: ["music-search", query],
    enabled: enabled && query.trim().length > 1,
    queryFn: () =>
      apiGet<{ tracks: RemoteMusicTrack[]; configured: boolean }>(
        `/api/music/search?q=${encodeURIComponent(query.trim())}`,
      ),
  });
}
