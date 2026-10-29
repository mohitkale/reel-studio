"use client";
import { useState } from "react";
import { useResearchCapabilities } from "@/hooks/research";
import {
  researchReadiness,
  type ResearchCapabilityView,
} from "@/research/readiness";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

const selectClass =
  "border-input bg-background focus-visible:ring-ring h-10 w-full rounded-md border px-3 text-sm focus-visible:ring-2 focus-visible:outline-none disabled:opacity-50";

export function ResearchReadinessFields({
  view,
}: {
  view: ResearchCapabilityView;
}) {
  const [mode, setMode] = useState<"supplied" | "web">("supplied");
  const [writerId, setWriterId] = useState("ollama");
  const [writerModels, setWriterModels] = useState<Record<string, string>>({});
  const [researcherId, setResearcherId] = useState("");
  const [researcherModels, setResearcherModels] = useState<
    Record<string, string>
  >({});
  const writer = view.writers.find((item) => item.id === writerId);
  const writerModel = writerModels[writerId] ?? writer?.defaultModel ?? "";
  const researcherModel =
    researcherModels[researcherId] ??
    (researcherId === "gemini" || researcherId === "openai"
      ? view.defaultResearchModels[researcherId]
      : "");
  const models = view.capabilities.filter(
    (item) => item.providerId === researcherId && item.nativeSearch,
  );
  const readiness = researchReadiness(
    {
      mode,
      writerProviderId: writerId,
      writerModelId: writerModel,
      researcherProviderId: researcherId,
      researcherModelId: researcherModel,
    },
    view,
  );
  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <Label htmlFor="research-mode">Research mode</Label>
        <select
          id="research-mode"
          className={selectClass}
          value={mode}
          onChange={(event) =>
            setMode(event.target.value as "supplied" | "web")
          }
        >
          <option value="supplied">Sources only — no cloud search</option>
          <option value="web">Web research — explicit cloud researcher</option>
        </select>
      </div>
      <div className="grid gap-5 md:grid-cols-2">
        <fieldset className="space-y-3 rounded-lg border p-4">
          <legend className="px-1 text-sm font-medium">Writer</legend>
          <div className="space-y-2">
            <Label htmlFor="research-writer">Writer provider</Label>
            <select
              id="research-writer"
              className={selectClass}
              value={writerId}
              onChange={(event) => setWriterId(event.target.value)}
            >
              {view.writers.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.label}
                  {item.configured ? "" : " — not configured"}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="research-writer-model">Writer model</Label>
            <Input
              id="research-writer-model"
              value={writerModel}
              onChange={(event) =>
                setWriterModels({
                  ...writerModels,
                  [writerId]: event.target.value,
                })
              }
              placeholder="Choose an installed or configured model"
            />
          </div>
          <p className="text-muted-foreground text-xs">
            {readiness.writerCapability.sharedBackend
              ? "Local writing can use supplied sources or saved evidence from a shared researcher."
              : "Writing and research models are selected separately."}
          </p>
        </fieldset>
        <fieldset
          className="space-y-3 rounded-lg border p-4"
          disabled={mode === "supplied"}
        >
          <legend className="px-1 text-sm font-medium">Researcher</legend>
          <div className="space-y-2">
            <Label htmlFor="research-provider">Research provider</Label>
            <select
              id="research-provider"
              className={selectClass}
              value={researcherId}
              onChange={(event) => setResearcherId(event.target.value)}
            >
              <option value="">Choose researcher</option>
              {(["gemini", "openai"] as const).map((id) => (
                <option key={id} value={id}>
                  {id === "gemini" ? "Gemini" : "OpenAI"}
                  {view.configuredProviders[id] ? "" : " — API key missing"}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="research-model">Research model</Label>
            <select
              id="research-model"
              className={selectClass}
              value={researcherModel}
              disabled={!researcherId}
              onChange={(event) =>
                setResearcherModels({
                  ...researcherModels,
                  [researcherId]: event.target.value,
                })
              }
            >
              <option value="">Choose research model</option>
              {models.map((item) => (
                <option key={item.modelId} value={item.modelId}>
                  {item.modelId}
                </option>
              ))}
            </select>
          </div>
        </fieldset>
      </div>
      <div
        className="space-y-2 rounded-lg border p-4"
        role="status"
        aria-live="polite"
      >
        <Badge variant={readiness.ready ? "success" : "secondary"}>
          {readiness.ready ? "Configuration ready" : "Setup needed"}
        </Badge>
        {readiness.issues.length ? (
          <ul className="text-muted-foreground list-disc space-y-1 pl-4 text-sm">
            {readiness.issues.map((issue) => (
              <li key={issue}>{issue}</li>
            ))}
          </ul>
        ) : (
          <p className="text-muted-foreground text-sm">
            This selection has the required configuration. Server/model
            availability is checked when used.
          </p>
        )}
      </div>
      <dl className="grid gap-3 text-sm sm:grid-cols-2">
        <div>
          <dt className="font-medium">Writer native search</dt>
          <dd className="text-muted-foreground">
            {readiness.writerCapability.nativeSearch
              ? "Supported for this model"
              : "Unavailable for this model"}
          </dd>
        </div>
        <div>
          <dt className="font-medium">Research URL context</dt>
          <dd className="text-muted-foreground">
            {mode === "supplied"
              ? "Public article capture; no cloud search"
              : readiness.researcherCapability.urlContext
                ? "Supported"
                : "Unavailable; use Gemini or supplied articles"}
          </dd>
        </div>
      </dl>
      <div className="text-muted-foreground space-y-2 text-xs">
        <p>
          {mode === "supplied"
            ? "Research uses supplied text or public articles without cloud calls. A cloud writer still needs its own key and writing allowance."
            : `Research allows at most ${view.bounds.maxProviderCalls} provider call plus ${view.bounds.maxSearchChargeUnits} ${readiness.researcherCapability.searchChargeUnit === "web_search_call" ? "web-search call" : "grounded-prompt charge"}. No cloud backend is substituted.`}
        </p>
        <p>
          Research: up to {view.bounds.maxDeadlineMs / 1000} seconds and{" "}
          {view.bounds.maxOutputTokens} output tokens. Local writing:{" "}
          {view.bounds.maxLocalWriterCalls} generation and{" "}
          {view.bounds.maxWriterContextChars.toLocaleString("en-US")} evidence
          characters. Call limits are not a currency spending cap.
        </p>
        <p>
          Model discovery does not prove search support. Citations record
          provenance, not guaranteed truth. These selections check readiness;
          they make no provider calls.
        </p>
      </div>
    </div>
  );
}

export function ResearchReadinessCard() {
  const { data, isLoading, error } = useResearchCapabilities();
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">
          Research and writer readiness
        </CardTitle>
        <CardDescription>
          Choose research separately from the model that writes your draft.
          Check native search, shared evidence and sources-only setups.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-muted-foreground text-sm">
            Loading research capabilities…
          </p>
        ) : error || !data ? (
          <p role="alert" className="text-muted-foreground text-sm">
            Could not read research configuration. Reload Settings to try again.
          </p>
        ) : (
          <ResearchReadinessFields view={data} />
        )}
      </CardContent>
    </Card>
  );
}
