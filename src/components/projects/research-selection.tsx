"use client";

import * as React from "react";
import { apiGet, apiPost } from "@/lib/api-client";
import type { EvidencePack } from "@/research/contracts";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";

type Job = {
  id: string;
  state: string;
  evidenceId: string | null;
  error: string | null;
};

/** Research is explicit: submitting web mode reserves one provider call and one search charge. */
export function ResearchSelection({
  brief,
  onEvidence,
  mode,
  onModeChange,
}: {
  brief: string;
  onEvidence: (evidence: EvidencePack | null) => void;
  mode: "off" | "supplied" | "web";
  onModeChange: (mode: "off" | "supplied" | "web") => void;
}) {
  const [provider, setProvider] = React.useState<"gemini" | "openai">("gemini");
  const [source, setSource] = React.useState("");
  const [job, setJob] = React.useState<Job | null>(null);
  const [evidence, setEvidence] = React.useState<EvidencePack | null>(null);
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
    const timer = setTimeout(() => {
      void apiGet<{ job: Job }>(
        `/api/research/jobs/${encodeURIComponent(job.id)}`,
      )
        .then(({ job: next }) => setJob(next))
        .catch((err: Error) => setError(err.message));
    }, 1000);
    return () => clearTimeout(timer);
  }, [job]);
  React.useEffect(() => {
    if (!job?.evidenceId || job.state !== "succeeded") return;
    let live = true;
    void apiGet<{ evidence: EvidencePack }>(
      `/api/research/evidence/${encodeURIComponent(job.evidenceId)}`,
    )
      .then(({ evidence: pack }) => {
        if (live) {
          setEvidence(pack);
          onEvidence(pack);
        }
      })
      .catch((err: Error) => {
        if (live) setError(err.message);
      });
    return () => {
      live = false;
    };
  }, [job?.evidenceId, job?.state, onEvidence]);

  async function start() {
    setBusy(true);
    clear();
    const current = generation.current;
    try {
      const url = /^https?:\/\/\S+$/i.test(source.trim());
      const input = {
        idempotencyKey: `creation-research:${crypto.randomUUID()}`,
        query: brief.trim(),
        mode,
        ...(mode === "web"
          ? {
              providerId: provider,
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
      };
      const response = await apiPost<{ job: Job }>("/api/research/jobs", input);
      if (generation.current === current) setJob(response.job);
    } catch (err) {
      if (generation.current === current)
        setError(err instanceof Error ? err.message : "Research failed");
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
            }}
          >
            <option value="gemini">Gemini</option>
            <option value="openai">OpenAI</option>
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
          Research sources
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
      {evidence && (
        <div className="space-y-1 text-sm">
          <p>
            Evidence revision {evidence.revision}. Citations show provenance,
            not guaranteed truth.
          </p>
          {evidence.attribution.searchSuggestionHtml && (
            <iframe
              title="Google Search suggestions"
              sandbox="allow-popups allow-popups-to-escape-sandbox"
              referrerPolicy="no-referrer"
              className="w-full border-0"
              srcDoc={`<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'">${evidence.attribution.searchSuggestionHtml}`}
            />
          )}
          <ul>
            {evidence.sources.map((item) => (
              <li key={item.id}>
                {item.url ? (
                  <a
                    href={item.url}
                    target="_blank"
                    rel="noreferrer"
                    className="underline"
                  >
                    {item.title}
                  </a>
                ) : (
                  item.title
                )}{" "}
                — retrieved {item.retrievedAt.slice(0, 10)}
                {item.publishedAt
                  ? `; published ${item.publishedAt.slice(0, 10)}`
                  : ""}
              </li>
            ))}
          </ul>
          {evidence.claims.map((claim) => (
            <p key={claim.id}>{claim.text}</p>
          ))}
          {evidence.conflicts.map((conflict) => (
            <p key={conflict.id}>Conflict: {conflict.description}</p>
          ))}
          {evidence.gaps.map((gap) => (
            <p key={gap}>Gap: {gap}</p>
          ))}
        </div>
      )}
    </div>
  );
}
