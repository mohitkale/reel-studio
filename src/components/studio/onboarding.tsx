"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CheckCircle2,
  CircleAlert,
  CircleX,
  Copy,
  Loader2,
  Play,
} from "lucide-react";

import { AIProviderCard } from "@/components/ai/ai-provider-card";
import { LocalAIProviderCard } from "@/components/ai/local-ai-provider-card";
import { Button } from "@/components/ui/button";
import { useAIProviders, useLocalAIProviders } from "@/hooks/ai";
import { useStudioDiagnostics } from "@/hooks/diagnostics";
import { useSetUiMode, useUiState } from "@/hooks/ui-mode";
import { apiGet, apiPost } from "@/lib/api-client";
import { cn } from "@/lib/utils";

/** Sample voices shown while choosing. Kokoro runs on this computer. */
const SAMPLE_VOICES = [
  { id: "af_heart", label: "Heart", detail: "US, warm" },
  { id: "am_michael", label: "Michael", detail: "US, steady" },
  { id: "bf_emma", label: "Emma", detail: "UK, clear" },
] as const;

interface VoiceModelStatus {
  cached: boolean;
  approxBytes: number;
  job:
    | { state: "idle" }
    | {
        state: "downloading";
        progress?: { bytesDone: number; bytesTotal: number };
      }
    | { state: "done" }
    | { state: "error"; message: string };
}

const STEPS = ["Ready check", "Voice", "Who writes the storyboard?"] as const;
const MCP_LINE =
  "claude mcp add reel-studio -- node /path/to/reel-studio/bin/reel-studio.mjs mcp";

const statusIcon = {
  pass: CheckCircle2,
  warn: CircleAlert,
  fail: CircleX,
} as const;
const statusClass = {
  pass: "text-success",
  warn: "text-warning",
  fail: "text-destructive",
} as const;

function ReadyCheck() {
  const diagnostics = useStudioDiagnostics();
  const report = diagnostics.data;
  return (
    <div className="space-y-3">
      <p className="text-muted-foreground text-sm">
        The studio checks this computer for what it needs. Everything runs here;
        nothing is uploaded.
      </p>
      {diagnostics.isLoading && (
        <p role="status" className="text-muted-foreground text-sm">
          Checking…
        </p>
      )}
      {diagnostics.isError && (
        <p role="alert" className="text-destructive text-sm">
          The check could not run: {diagnostics.error.message}
        </p>
      )}
      <ul className="space-y-2">
        {report?.checks.map((check) => {
          const Icon = statusIcon[check.status];
          return (
            <li key={check.id} className="flex gap-2 text-sm">
              <Icon
                className={cn(
                  "mt-0.5 size-4 shrink-0",
                  statusClass[check.status],
                )}
                aria-label={check.status}
              />
              <div>
                <span className="font-medium">{check.label}</span>
                <span className="text-muted-foreground"> · {check.detail}</span>
                {check.status !== "pass" && check.fix && (
                  <code className="bg-muted mt-1 block rounded px-2 py-1 text-xs">
                    {check.fix}
                  </code>
                )}
              </div>
            </li>
          );
        })}
      </ul>
      {report && !report.ready && (
        <p className="text-sm">
          Something required is missing. Run{" "}
          <code className="bg-muted rounded px-1">npm run doctor -- --fix</code>{" "}
          in a terminal; it asks before each download. Then check again.
        </p>
      )}
      <Button
        variant="outline"
        size="sm"
        onClick={() => void diagnostics.refetch()}
        disabled={diagnostics.isFetching}
      >
        {diagnostics.isFetching && (
          <Loader2 className="size-4 animate-spin" aria-hidden />
        )}
        Check again
      </Button>
    </div>
  );
}

function VoiceStep() {
  const queryClient = useQueryClient();
  const [error, setError] = React.useState<string>();
  const [playing, setPlaying] = React.useState<string>();
  const status = useQuery({
    queryKey: ["voice-model"],
    queryFn: () => apiGet<VoiceModelStatus>("/api/voice-model"),
    refetchInterval: (query) =>
      query.state.data?.job.state === "downloading" ? 1500 : false,
  });
  const data = status.data;
  const downloading = data?.job.state === "downloading";
  const progress =
    data?.job.state === "downloading" ? data.job.progress : undefined;
  const percent =
    progress && progress.bytesTotal > 0
      ? Math.round((progress.bytesDone / progress.bytesTotal) * 100)
      : null;

  async function download() {
    setError(undefined);
    try {
      await apiPost("/api/voice-model", { confirm: true });
      await queryClient.invalidateQueries({ queryKey: ["voice-model"] });
    } catch (e) {
      setError(e instanceof Error ? e.message : "The download did not start");
    }
  }

  async function play(voiceId: string) {
    setError(undefined);
    setPlaying(voiceId);
    try {
      const result = await apiPost<{ audioUrl: string }>("/api/voice-preview", {
        providerId: "kokoro",
        voiceId,
      });
      await new Audio(result.audioUrl).play();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not play the sample");
    } finally {
      setPlaying(undefined);
    }
  }

  return (
    <div className="space-y-3">
      <p className="text-muted-foreground text-sm">
        Narration is made on this computer with the Kokoro voice model (about{" "}
        {data ? Math.round(data.approxBytes / 1e6) : 90} MB, one time). You can
        skip it: videos are then silent with captions.
      </p>
      {data?.cached ? (
        <div className="flex flex-wrap gap-2">
          {SAMPLE_VOICES.map((voice) => (
            <Button
              key={voice.id}
              variant="outline"
              size="sm"
              disabled={playing !== undefined}
              onClick={() => void play(voice.id)}
              aria-label={`Play sample of ${voice.label}`}
            >
              {playing === voice.id ? (
                <Loader2 className="size-4 animate-spin" aria-hidden />
              ) : (
                <Play className="size-4" aria-hidden />
              )}
              {voice.label} · {voice.detail}
            </Button>
          ))}
        </div>
      ) : (
        <div className="space-y-2">
          <Button
            size="sm"
            onClick={() => void download()}
            disabled={downloading || status.isLoading}
          >
            {downloading && (
              <Loader2 className="size-4 animate-spin" aria-hidden />
            )}
            {downloading
              ? `Downloading${percent !== null ? ` ${percent}%` : "…"}`
              : "Download the voice"}
          </Button>
          {downloading && percent !== null && (
            <progress
              value={percent}
              max={100}
              aria-label="Voice download progress"
              className="block h-2 w-full max-w-xs"
            />
          )}
          {data?.job.state === "error" && (
            <p role="alert" className="text-destructive text-sm">
              The download stopped: {data.job.message} Try again; it resumes
              where it left off.
            </p>
          )}
        </div>
      )}
      {error && (
        <p role="alert" className="text-destructive text-sm">
          {error}
        </p>
      )}
    </div>
  );
}

type WriterChoice = "mcp" | "key" | "local" | "paste";

function WriterStep() {
  const [choice, setChoice] = React.useState<WriterChoice>("mcp");
  const [copied, setCopied] = React.useState(false);
  const providers = useAIProviders();
  const local = useLocalAIProviders();
  const options: { id: WriterChoice; title: string; body: string }[] = [
    {
      id: "mcp",
      title: "My AI agent (MCP)",
      body: "Claude, Cursor or another agent writes it and asks the studio to make the video.",
    },
    {
      id: "key",
      title: "An API key",
      body: "Gemini or OpenAI. The key stays on this computer and only the storyboard text is sent.",
    },
    {
      id: "local",
      title: "A local model",
      body: "Ollama or LM Studio on this computer. Nothing leaves it.",
    },
    {
      id: "paste",
      title: "I'll paste it myself",
      body: "Copy a prompt into any chat assistant, paste its reply back. No key needed.",
    },
  ];

  return (
    <div className="space-y-3">
      <p className="text-muted-foreground text-sm">
        Only the storyboard text is ever written by an AI. Voice, scenes,
        captions and the MP4 are made here, the same way every time.
      </p>
      <div
        role="radiogroup"
        aria-label="Who writes the storyboard"
        className="grid gap-2 sm:grid-cols-2"
      >
        {options.map((option) => (
          <button
            key={option.id}
            type="button"
            role="radio"
            aria-checked={choice === option.id}
            onClick={() => setChoice(option.id)}
            className={cn(
              "focus-visible:ring-ring rounded-lg border p-3 text-left text-sm focus-visible:ring-2 focus-visible:outline-none",
              choice === option.id && "border-primary bg-primary/5",
            )}
          >
            <span className="block font-medium">{option.title}</span>
            <span className="text-muted-foreground block text-xs">
              {option.body}
            </span>
          </button>
        ))}
      </div>
      {choice === "mcp" && (
        <div className="space-y-2">
          <code className="bg-muted block rounded px-2 py-2 text-xs break-all">
            {MCP_LINE}
          </code>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              void navigator.clipboard
                ?.writeText(MCP_LINE)
                .then(() => setCopied(true))
                .catch(() => setCopied(false));
            }}
          >
            <Copy className="size-4" aria-hidden />
            {copied ? "Copied" : "Copy the line"}
          </Button>
          <p className="text-muted-foreground text-xs">
            Replace the path with where Reel Studio lives. Other agents:
            docs/MCP.md.
          </p>
        </div>
      )}
      {choice === "key" && (
        <div className="space-y-3">
          {providers.isLoading && (
            <p role="status" className="text-muted-foreground text-sm">
              Loading…
            </p>
          )}
          {providers.data
            ?.filter((p) => p.kind === "cloud")
            .map((p) => (
              <AIProviderCard key={p.id} status={p} />
            ))}
        </div>
      )}
      {choice === "local" && (
        <div className="space-y-3">
          {local.isLoading && (
            <p role="status" className="text-muted-foreground text-sm">
              Looking for Ollama and LM Studio…
            </p>
          )}
          {local.data?.map((p) => (
            <LocalAIProviderCard key={p.id} status={p} />
          ))}
        </div>
      )}
      {choice === "paste" && (
        <p className="text-sm">
          Nothing to set up. On the Create screen, choose{" "}
          <em>Copy the prompt</em>, paste it into any chat assistant, then paste
          the reply back.
        </p>
      )}
    </div>
  );
}

/**
 * First-run setup in three steps (roadmap U2): ready check, voice, and who writes
 * the storyboard. It ends by making a sample video from a built-in storyboard so
 * the result appears with no AI. Shown once; Settings has "Run setup again".
 */
export function Onboarding() {
  const router = useRouter();
  const state = useUiState();
  const setMode = useSetUiMode();
  const [step, setStep] = React.useState(0);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string>();

  if (!state.data?.needsOnboarding) return null;

  async function finish(makeSample: boolean) {
    setBusy(true);
    setError(undefined);
    try {
      let jobId: string | null | undefined;
      if (makeSample) {
        const { storyboard } = await apiGet<{
          storyboard: Record<string, unknown>;
        }>("/api/examples/explainer");
        const queued = await apiPost<{ jobId?: string | null }>(
          "/api/storyboards",
          { storyboard, quality: "draft" },
        );
        jobId = queued.jobId;
        if (!jobId)
          throw new Error("The studio did not start the sample video");
      }
      await setMode.mutateAsync({ onboarded: true });
      if (jobId) router.push(`/results/${jobId}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
      setBusy(false);
    }
  }

  const last = step === STEPS.length - 1;
  return (
    <section
      aria-labelledby="onboarding-title"
      className="bg-card space-y-4 rounded-xl border p-4"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="onboarding-title" className="text-base font-semibold">
          Set up in under a minute · step {step + 1} of {STEPS.length}:{" "}
          {STEPS[step]}
        </h2>
        <Button
          variant="ghost"
          size="sm"
          disabled={busy}
          onClick={() => void setMode.mutateAsync({ onboarded: true })}
        >
          Skip setup
        </Button>
      </div>
      {step === 0 && <ReadyCheck />}
      {step === 1 && <VoiceStep />}
      {step === 2 && <WriterStep />}
      {error && (
        <p role="alert" className="text-destructive text-sm">
          {error}{" "}
          <button className="underline" onClick={() => void finish(true)}>
            Try again
          </button>
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        {step > 0 && (
          <Button
            variant="outline"
            disabled={busy}
            onClick={() => setStep(step - 1)}
          >
            Back
          </Button>
        )}
        {!last ? (
          <Button onClick={() => setStep(step + 1)}>
            {step === 1 ? "Continue (or skip the voice)" : "Continue"}
          </Button>
        ) : (
          <Button disabled={busy} onClick={() => void finish(true)}>
            {busy && <Loader2 className="size-4 animate-spin" aria-hidden />}
            Finish and make a sample video
          </Button>
        )}
      </div>
    </section>
  );
}
