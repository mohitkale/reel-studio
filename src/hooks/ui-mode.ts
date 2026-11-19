"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import type { UiMode, UiState } from "@/server/ui-mode";
import { DEFAULT_AUTOMATION, type Automation } from "@/lib/automation";
import { apiGet, apiPost } from "@/lib/api-client";

export type { UiMode };

const KEY = ["ui-mode"] as const;

/** Current Simple/Pro mode and first-run state. */
export function useUiState() {
  return useQuery({
    queryKey: KEY,
    queryFn: () => apiGet<UiState>("/api/ui-mode"),
    staleTime: 60_000,
  });
}

export function useUiMode(): { mode: UiMode; ready: boolean } {
  const { data } = useUiState();
  // Pro until loaded, so an existing workspace never flashes a reduced menu.
  return { mode: data?.mode ?? "pro", ready: Boolean(data) };
}

export function useSetUiMode() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      mode?: UiMode;
      onboarded?: boolean;
      reviewBeforeMaking?: boolean;
      endTag?: boolean;
      automation?: Partial<Automation>;
    }) => apiPost<UiState>("/api/ui-mode", input),
    // Show a switch's new value at once; the server's answer replaces it.
    onMutate: async (input) => {
      await client.cancelQueries({ queryKey: KEY });
      const previous = client.getQueryData<UiState>(KEY);
      if (previous) {
        client.setQueryData<UiState>(KEY, {
          ...previous,
          ...(input.mode ? { mode: input.mode } : {}),
          ...(input.reviewBeforeMaking !== undefined
            ? { reviewBeforeMaking: input.reviewBeforeMaking }
            : {}),
          ...(input.endTag !== undefined ? { endTag: input.endTag } : {}),
          ...(input.automation
            ? { automation: { ...previous.automation, ...input.automation } }
            : {}),
        });
      }
      return { previous };
    },
    onError: (_error, _input, context) => {
      if (context?.previous) client.setQueryData(KEY, context.previous);
    },
    onSuccess: (state) => client.setQueryData(KEY, state),
  });
}

/** Extra request fields so a video waits for review when the user turned that on. */
export function useReviewFields(): { review?: true } {
  const { data } = useUiState();
  return data?.reviewBeforeMaking ? { review: true } : {};
}

/** The saved defaults for which steps run by themselves. */
export function useAutomation(): Automation {
  const { data } = useUiState();
  return data?.automation ?? DEFAULT_AUTOMATION;
}
