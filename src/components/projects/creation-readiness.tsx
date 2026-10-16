"use client";

import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { apiGet } from "@/lib/api-client";
import type { AIProviderStatus } from "@/providers/ai/types";
import type { LocalAIProviderView } from "@/providers/ai/local-types";
import { Button } from "@/components/ui/button";

export function CreationReadiness() {
  const qc = useQueryClient();
  const controller = useRef<AbortController | null>(null);
  useEffect(() => () => controller.current?.abort(), []);
  const [language, setLanguage] = useState("English");
  const report = useQuery({
    queryKey: ["creation-readiness"],
    queryFn: () =>
      apiGet<{ local: LocalAIProviderView[]; connected: AIProviderStatus[] }>(
        "/api/creation-readiness",
      ),
  });
  const test = useMutation({
    mutationFn: async (providerId: string) => {
      controller.current = new AbortController();
      const response = await fetch("/api/creation-readiness", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ providerId, language }),
        signal: controller.current.signal,
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Local test failed");
      return data;
    },
    onSettled: () => {
      controller.current = null;
      void qc.invalidateQueries({ queryKey: ["creation-readiness"] });
    },
  });
  return (
    <section
      aria-label="Creation readiness"
      className="bg-card space-y-3 rounded-xl border p-4"
    >
      <h3 className="text-sm font-semibold">Creation readiness</h3>
      <p className="text-sm">
        <strong>Works immediately:</strong> supplied text and manual editing use
        the local planner. Choose no automatic media and leave narration off for
        offline creation.{" "}
        <Link className="underline" href="/diagnostics">
          Check rendering setup
        </Link>
        .
      </p>
      <p className="text-muted-foreground text-xs">
        Local narration needs cached voice weights; first use can download a
        model. These checks do not load voice weights.
      </p>
      {report.isError && (
        <p role="alert" className="text-sm">
          {report.error.message}
        </p>
      )}
      {report.isLoading && (
        <p className="text-sm">Reading saved provider configuration…</p>
      )}
      <label className="flex items-center gap-2 text-xs">
        Local test language
        <select
          className="bg-background rounded border p-1"
          aria-label="Readiness test language"
          value={language}
          disabled={test.isPending}
          onChange={(event) => setLanguage(event.target.value)}
        >
          {["English", "Hindi", "Hinglish"].map((value) => (
            <option key={value}>{value}</option>
          ))}
        </select>
      </label>
      {report.data?.local.map((provider) => (
        <div className="rounded border p-3 text-xs" key={provider.id}>
          <p className="font-medium">
            Local AI · {provider.label} ·{" "}
            {provider.modelId || "No model selected"}
          </p>
          <p className="mt-1">
            Availability: {provider.diagnostic.state} ·{" "}
            {provider.diagnostic.message}
          </p>
          <p className="mt-1">
            Context:{" "}
            {provider.contextWindow
              ? `${provider.contextWindow.toLocaleString()} configured tokens`
              : "Server default; capacity unverified"}
            . Output:{" "}
            {provider.maxOutputTokens
              ? `${provider.maxOutputTokens} configured tokens`
              : "Server default"}
            .
          </p>
          <p className="mt-1">
            {provider.generationProbe
              ? `Structured output passed · ${provider.generationProbe.latencyMs} ms · ${provider.generationProbe.language} requested · ${new Date(provider.generationProbe.checkedAt).toLocaleString()}`
              : "Structured output and latency have not passed a saved test for this configuration."}
          </p>
          <Button
            className="mt-2"
            size="sm"
            variant="outline"
            disabled={!provider.modelId || test.isPending}
            onClick={() => test.mutate(provider.id)}
          >
            Test local planning
          </Button>
        </div>
      ))}
      {test.isPending && (
        <Button
          size="sm"
          variant="outline"
          onClick={() => controller.current?.abort()}
        >
          Cancel local test
        </Button>
      )}
      {test.isError && (
        <p role="alert" className="text-sm">
          {test.error.name === "AbortError"
            ? "Local test cancelled"
            : test.error.message}
        </p>
      )}
      <p className="text-muted-foreground text-xs">
        The optional test makes a bounded planning test to your selected local
        endpoint, with a 60-second deadline. A passed schema test does not
        certify factual accuracy, language fluency, context capacity, or
        cancellation support in the server.
      </p>
      <p className="text-sm">
        <strong>Optional connected generation:</strong>{" "}
        {report.data?.connected
          .filter((provider) => provider.configured)
          .map((provider) => provider.label)
          .join(", ") || "No cloud planner configured"}
        . Select a provider explicitly in AI creation; connected generation may
        incur provider costs.
      </p>
      <Link href="/settings" className="text-xs underline">
        Configure providers and discover installed models
      </Link>
    </section>
  );
}
