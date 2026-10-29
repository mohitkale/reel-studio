"use client";
import { useQuery } from "@tanstack/react-query";
import { apiGet } from "@/lib/api-client";
import { researchCapabilityViewSchema } from "@/research/readiness";

export function useResearchCapabilities() {
  return useQuery({
    queryKey: ["research-capabilities"],
    queryFn: async () =>
      researchCapabilityViewSchema.parse(
        await apiGet<unknown>("/api/research/capabilities"),
      ),
  });
}
