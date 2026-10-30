"use client";

import * as React from "react";
import { apiGet, apiPost } from "@/lib/api-client";
import { researchRequestSchema, type EvidencePack } from "@/research/contracts";
import { EvidenceReview } from "./evidence-review";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import {
  GEMINI_RESEARCH_MODELS,
  OPENAI_RESEARCH_MODELS,
  defaultResearchModel,
} from "@/research/capabilities";

type Job = {
  id: string;
  state: string;
  evidenceId: string | null;
  error: string | null;
};
const RECONNECT_KEY = "reel-creation-research-request";

/** Research is explicit: submitting web mode reserves one provider call and one search charge. */
export function ResearchSelection({
  brief,
  onEvidence,
  mode,
  onModeChange,
  initialEvidence,
}: {
  brief: string;
  onEvidence: (evidence: EvidencePack | null) => void;
  mode: "off" | "supplied" | "web";
  onModeChange: (mode: "off" | "supplied" | "web") => void;
  initialEvidence?: EvidencePack;
}) {
  const [provider, setProvider] = React.useState<"gemini" | "openai">(
    initialEvidence?.provenance.providerId === "openai" ? "openai" : "gemini",
  );
  const [model, setModel] = React.useState(
    initialEvidence?.provenance.modelId ??
      defaultResearchModel(initialEvidence?.provenance.providerId ?? undefined),
  );
  const [source, setSource] = React.useState("");
  const [job, setJob] = React.useState<Job | null>(null);
  const [evidence, setEvidence] = React.useState<EvidencePack | null>(
    initialEvidence ?? null,
  );
  const [error, setError] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const generation = React.useRef(0);
  const clear = () => {
    generation.current++;
    setJob(null);
    setEvidence(null);
    onEvidence(null);
    setError("");
  };

  React.useEffect(() => {
    if (!job || !["queued", "running"].includes(job.state)) return;
    let live = true;
    const current = generation.current;
    const timer = setTimeout(() => {
      void apiGet<{ job: Job }>(
        `/api/research/jobs/${encodeURIComponent(job.id)}`,
      )
        .then(({ job: next }) => {
          if (live && current === generation.current) setJob(next);
        })
        .catch((err: Error) => {
          if (live && current === generation.current) setError(err.message);
        });
    }, 1000);
    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [job]);
  React.useEffect(() => {
    if (!job?.evidenceId || job.state !== "succeeded") return;
    let live = true;
    const current = generation.current;
    void apiGet<{ evidence: EvidencePack }>(
      `/api/research/evidence/${encodeURIComponent(job.evidenceId)}`,
    )
      .then(({ evidence: pack }) => {
        if (live && current === generation.current) {
          setEvidence(pack);
          onEvidence(pack);
        }
      })
      .catch((err: Error) => {
        if (live && current === generation.current) setError(err.message);
      });
    return () => {
      live = false;
    };
  }, [job?.evidenceId, job?.state, onEvidence]);

  async function start() {
    const refreshing = Boolean(evidence);
    setBusy(true);
    clear();
    const current = generation.current;
    try {
      const url = /^https?:\/\/\S+$/i.test(source.trim());
      const input = researchRequestSchema.parse({
        idempotencyKey: `creation-research:${crypto.randomUUID()}`,
        query: brief.trim(),
        mode,
        refresh: refreshing,
        ...(mode === "web"
          ? {
              providerId: provider,
              modelId: model,
              budget: {
                maxProviderCalls: 1,
                maxSearchChargeUnits: 1,
                deadlineMs: 45000,
                maxOutputTokens: 2048,
              },
            }
          : {
              urls: url ? [source.trim()] : [],
              sources: url
                ? []
                : [{ title: "Supplied source", text: source.trim() }],
            }),
      });
      try {
        sessionStorage.setItem(RECONNECT_KEY, JSON.stringify(input));
      } catch {
        /* Research still works when browser storage is disabled. */
      }
      const response = await apiPost<{ job: Job }>("/api/research/jobs", input);
      if (generation.current === current) setJob(response.job);
    } catch (err) {
      if (generation.current === current)
        setError(err instanceof Error ? err.message : "Research failed");
    } finally {
      setBusy(false);
    }
  }
  async function reconnect() {
    const current = generation.current;
    try {
      const saved = researchRequestSchema.parse(
        JSON.parse(sessionStorage.getItem(RECONNECT_KEY) ?? "null"),
      );
      if (saved.query !== brief.trim() || saved.mode !== mode)
        throw new Error(
          "No saved research request matches this brief and mode in this tab.",
        );
      setBusy(true);
      const response = await apiPost<{ job: Job }>("/api/research/jobs", saved);
      if (current === generation.current) {
        setError("");
        setJob(response.job);
      }
    } catch {
      if (current === generation.current)
        setError(
          "Unable to reconnect. Restore the same brief and research mode in this tab, or start a new request explicitly.",
        );
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="space-y-2 rounded-lg border p-3">
      <Label htmlFor="creation-research-mode">Research</Label>
      <NativeSelect
        id="creation-research-mode"
        value={mode}
        onChange={(event) => {
          clear();
          onModeChange(event.target.value as typeof mode);
        }}
      >
        <option value="off">Off</option>
        <option value="supplied">Supplied source</option>
        <option value="web">Web research</option>
      </NativeSelect>
      {mode === "supplied" && (
        <Textarea
          aria-label="Source text or URL"
          value={source}
          onChange={(event) => {
            clear();
            setSource(event.target.value);
          }}
          placeholder="Paste source text or a public article URL"
        />
      )}
      {mode === "web" && (
        <>
          <NativeSelect
            aria-label="Research provider"
            value={provider}
            onChange={(event) => {
              clear();
              setProvider(event.target.value as typeof provider);
              setModel(defaultResearchModel(event.target.value));
            }}
          >
            <option value="gemini">Gemini</option>
            <option value="openai">OpenAI</option>
          </NativeSelect>
          <NativeSelect
            aria-label="Research model"
            value={model}
            onChange={(event) => {
              clear();
              setModel(event.target.value);
            }}
          >
            {!(
              provider === "gemini"
                ? GEMINI_RESEARCH_MODELS
                : OPENAI_RESEARCH_MODELS
            ).some((id) => id === model) && (
              <option value={model}>{model} (unavailable)</option>
            )}
            {(provider === "gemini"
              ? GEMINI_RESEARCH_MODELS
              : OPENAI_RESEARCH_MODELS
            ).map((id) => (
              <option key={id} value={id}>
                {id}
              </option>
            ))}
          </NativeSelect>
          <p className="text-muted-foreground text-xs">
            Web research can use one paid provider call and one search charge.
          </p>
        </>
      )}
      {mode !== "off" && (
        <Button
          type="button"
          variant="outline"
          disabled={
            busy ||
            brief.trim().length < 3 ||
            (mode === "supplied" && !source.trim()) ||
            job?.state === "running" ||
            job?.state === "queued"
          }
          onClick={() => void start()}
        >
          {evidence ? "Refresh research" : "Research sources"}
        </Button>
      )}
      {mode !== "off" && !job && (
        <Button
          type="button"
          variant="outline"
          disabled={busy}
          onClick={() => void reconnect()}
        >
          Reconnect to previous research
        </Button>
      )}
      {job && (
        <p role="status" className="text-sm">
          Research: {job.state}
          {job.error ? ` — ${job.error}` : ""}
        </p>
      )}
      {error && (
        <p role="alert" className="text-destructive text-sm">
          {error}
        </p>
      )}
      {error && job && ["queued", "running"].includes(job.state) && (
        <Button
          type="button"
          variant="outline"
          onClick={() => {
            setError("");
            setJob({ ...job });
          }}
        >
          Reconnect to research
        </Button>
      )}
      {evidence && <EvidenceReview evidence={evidence} />}
    </div>
  );
}
