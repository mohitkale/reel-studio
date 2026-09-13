"use client";

import { useQuery } from "@tanstack/react-query";

import type { StudioDiagnosticReport } from "@/library/studio-diagnostics";
import { apiGet } from "@/lib/api-client";

export function useStudioDiagnostics() {
  return useQuery({
    queryKey: ["studio-diagnostics"],
    queryFn: async () =>
      (await apiGet<{ report: StudioDiagnosticReport }>("/api/diagnostics"))
        .report,
    staleTime: 30_000,
  });
}
