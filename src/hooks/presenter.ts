"use client";

import { useQuery } from "@tanstack/react-query";

import { apiGet } from "@/lib/api-client";
import type { Accent, Blink, MouthKey } from "@/video/visemes";

export interface PresenterTrackDTO {
  mouth: MouthKey[];
  blinks: Blink[];
  accents: Accent[];
}

/** The presenter's movements for the live preview; asked for only when the video has a presenter. */
export function usePresenterTrack(
  scriptId: string,
  enabled: boolean,
  version: string,
) {
  return useQuery({
    queryKey: ["presenter-track", scriptId, version],
    enabled,
    staleTime: 60_000,
    queryFn: () =>
      apiGet<PresenterTrackDTO>(`/api/scripts/${scriptId}/presenter-track`),
  });
}
