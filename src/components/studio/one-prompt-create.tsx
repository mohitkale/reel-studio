"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import { PasteStoryboard } from "@/components/studio/paste-storyboard";
import { useAIProviders } from "@/hooks/ai";
import { useReviewFields } from "@/hooks/ui-mode";
import { apiPost } from "@/lib/api-client";
import {
  buildWriteRequest,
  classifyEntry,
  EXAMPLE_PROMPTS,
  finishStoryboard,
  FORMATS,
  LENGTHS,
  SAMPLE_STORYBOARD,
  type FormatId,
  type LengthSeconds,
} from "@/lib/one-prompt";
import { THEMES } from "@/video/themes";

function Chip({
  active,
  onClick,
  children,
  label,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  label?: string;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      aria-label={label}
      onClick={onClick}
      className={`focus-visible:outline-ring min-h-10 rounded-full border px-4 text-sm focus-visible:outline-2 ${active ? "border-primary bg-primary/10 font-medium" : "bg-card hover:bg-muted"}`}
    >
      {children}
    </button>
  );
}

/**
 * One box, one button: describe the video and press Create. Everything else is
 * behind More options. The existing creation hub stays below for the other ways
 * to make things (podcast, voiceover, repurpose, manual production).
 */
export function OnePromptCreate() {
  const router = useRouter();
  const review = useReviewFields();
  const providers = useAIProviders();
  const [text, setText] = React.useState("");
  const [format, setFormat] = React.useState<FormatId>("9:16");
  const [seconds, setSeconds] = React.useState<LengthSeconds>(30);
  const [theme, setTheme] = React.useState("auto");
  const [narration, setNarration] = React.useState(true);
  const [busy, setBusy] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string>();

  const writer = providers.data?.find((p) => p.configured);
  const kind = classifyEntry(text);

  async function produce(storyboard: Record<string, unknown>) {
    const queued = await apiPost<{ jobId?: string | null }>(
      "/api/storyboards",
      {
        storyboard,
        quality: "standard",
        ...review,
      },
    );
    if (!queued.jobId) throw new Error("The studio did not start a video");
    router.push(`/results/${queued.jobId}`);
  }

  async function create() {
    setError(undefined);
    const request = buildWriteRequest(text, { format, seconds });
    if (!request || !writer) return;
    try {
      setBusy("Writing the storyboard…");
      const written = await apiPost<{
        storyboard?: Record<string, unknown>;
        errors?: Array<{ path: string; message: string }>;
      }>("/api/storyboards/write", { providerId: writer.id, ...request });
      if (!written.storyboard)
        throw new Error(
          written.errors?.map((e) => `${e.path}: ${e.message}`).join("; ") ||
            "The writer did not return a storyboard. Try again.",
        );
      setBusy("Starting the video…");
      await produce(finishStoryboard(written.storyboard, { theme, narration }));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
      setBusy(null);
    }
  }

  async function sample() {
    setError(undefined);
    try {
      setBusy("Starting the sample video…");
      await produce({ ...SAMPLE_STORYBOARD, format });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
      setBusy(null);
    }
  }

  return (
    <section aria-labelledby="one-prompt-heading" className="space-y-4">
      <h1
        id="one-prompt-heading"
        className="text-3xl font-semibold tracking-tight"
      >
        What do you want to make?
      </h1>
      <div className="bg-card space-y-4 rounded-xl border p-4 sm:p-5">
        <label htmlFor="one-prompt-input" className="sr-only">
          Describe your video: a topic, your own text or a link
        </label>
        <textarea
          id="one-prompt-input"
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={4}
          placeholder="A topic, your own text, or a link to a page"
          className="bg-background focus-visible:outline-ring w-full resize-y rounded-lg border p-3 text-base focus-visible:outline-2"
        />
        {kind === "own-text" && (
          <p className="text-muted-foreground text-xs">
            Using your text as the script source; nothing will be looked up.
          </p>
        )}
        {kind === "empty" && (
          <div className="flex flex-wrap gap-2" aria-label="Example ideas">
            {EXAMPLE_PROMPTS.map((example) => (
              <button
                key={example}
                type="button"
                onClick={() => setText(example)}
                className="text-muted-foreground hover:bg-muted focus-visible:outline-ring rounded-full border px-3 py-1.5 text-left text-xs focus-visible:outline-2"
              >
                {example}
              </button>
            ))}
          </div>
        )}
        <div className="flex flex-wrap gap-2" role="group" aria-label="Format">
          {FORMATS.map((f) => (
            <Chip
              key={f.id}
              active={format === f.id}
              onClick={() => setFormat(f.id)}
              label={`${f.label} ${f.hint}`}
            >
              {f.label} <span className="text-muted-foreground">{f.hint}</span>
            </Chip>
          ))}
          <Link
            href="/podcasts"
            className="focus-visible:outline-ring bg-card hover:bg-muted inline-flex min-h-10 items-center rounded-full border px-4 text-sm focus-visible:outline-2"
          >
            Podcast
          </Link>
        </div>
        <div className="flex flex-wrap gap-2" role="group" aria-label="Length">
          {LENGTHS.map((s) => (
            <Chip key={s} active={seconds === s} onClick={() => setSeconds(s)}>
              {s} s
            </Chip>
          ))}
        </div>
        <div
          className="flex gap-2 overflow-x-auto pb-1"
          role="group"
          aria-label="Look"
        >
          <Chip active={theme === "auto"} onClick={() => setTheme("auto")}>
            Auto
          </Chip>
          {THEMES.map((t) => (
            <button
              key={t.id}
              type="button"
              aria-pressed={theme === t.id}
              aria-label={`${t.name} look`}
              title={t.name}
              onClick={() => setTheme(t.id)}
              className={`focus-visible:outline-ring flex min-h-10 shrink-0 items-center gap-2 rounded-full border py-1 pr-3 pl-1 text-sm focus-visible:outline-2 ${theme === t.id ? "border-primary bg-primary/10 font-medium" : "bg-card hover:bg-muted"}`}
            >
              <span
                aria-hidden
                className="size-7 rounded-full border"
                style={{
                  background: `linear-gradient(135deg, ${t.palette.background}, ${t.palette.accent})`,
                }}
              />
              {t.name}
            </button>
          ))}
        </div>
        <details className="text-sm">
          <summary className="cursor-pointer font-medium">More options</summary>
          <label className="mt-3 flex items-center gap-2">
            <input
              type="checkbox"
              checked={narration}
              onChange={(e) => setNarration(e.target.checked)}
            />
            Narrate it with the local voice (turn off for a silent video with
            captions)
          </label>
        </details>
        <p className="text-sm">
          <Link href="/examples" className="underline">
            Or start from an example
          </Link>{" "}
          <span className="text-muted-foreground">
            (change the text, no AI needed)
          </span>
        </p>
        <details className="text-sm" open={!providers.isLoading && !writer}>
          <summary className="cursor-pointer font-medium">
            Use my own chat assistant (ChatGPT, Claude, Gemini, a local model)
          </summary>
          <div className="mt-3">
            <PasteStoryboard
              topic={text}
              format={format}
              seconds={seconds}
              theme={theme}
              narration={narration}
            />
          </div>
        </details>
        <div className="flex flex-wrap items-center gap-3">
          <Button
            size="lg"
            onClick={() => void create()}
            disabled={Boolean(busy) || kind === "empty" || !writer}
          >
            {busy ? (
              <Loader2 className="size-4 animate-spin" aria-hidden />
            ) : (
              <Sparkles className="size-4" aria-hidden />
            )}
            Create
          </Button>
          {busy && (
            <span role="status" className="text-muted-foreground text-sm">
              {busy}
            </span>
          )}
        </div>
        {!providers.isLoading && !writer && (
          <div
            role="note"
            className="bg-muted/50 space-y-2 rounded-lg border p-3 text-sm"
          >
            <p>
              Nothing is set up to write the storyboard yet. Add a Gemini or
              OpenAI key, or a local model, in{" "}
              <Link href="/settings" className="underline">
                Settings
              </Link>
              , or let an AI agent write it through MCP. You can still see a
              video right now:
            </p>
            <Button
              variant="outline"
              onClick={() => void sample()}
              disabled={Boolean(busy)}
            >
              Make a sample video
            </Button>
          </div>
        )}
        {error && (
          <p role="alert" className="text-destructive text-sm">
            {error}
          </p>
        )}
      </div>
    </section>
  );
}
