"use client";

import * as React from "react";
import Link from "next/link";
import { Download, Loader2, Pause, Play, RotateCcw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { NativeSelect } from "@/components/ui/native-select";
import { useAIProviders } from "@/hooks/ai";
import { useBrandKits } from "@/hooks/brandkits";
import { useAutomation } from "@/hooks/ui-mode";
import { apiGet, apiPost, apiPut } from "@/lib/api-client";
import {
  isBusy,
  newItems,
  nextItem,
  queuePosition,
  restoreItems,
  retry,
  retryAll,
  summarise,
  type BatchItem,
} from "@/lib/batch-queue";
import { buildWriteRequest, lengthLabel } from "@/lib/one-prompt";
import { MUSIC_LIBRARY } from "@/lib/music-library";
import { parseTopics, type Series } from "@/lib/series";
import { VOICE_STYLES, VOICE_STYLE_IDS } from "@/lib/voice-styles";
import { THEMES } from "@/video/themes";

const STORAGE_KEY = "reel-batch-v1";
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const EMPTY_SERIES: Series = { name: "" };

function SeriesEditor({
  list,
  onChange,
}: {
  list: Series[];
  onChange: (next: Series[]) => Promise<void>;
}) {
  const [draft, setDraft] = React.useState<Series>(EMPTY_SERIES);
  const brandKits = useBrandKits();
  const [error, setError] = React.useState<string>();
  const set = (patch: Partial<Series>) => setDraft((d) => ({ ...d, ...patch }));

  async function save() {
    setError(undefined);
    const name = draft.name.trim();
    if (!name) return setError("Give the series a name");
    const without = list.filter(
      (s) => s.name.toLowerCase() !== name.toLowerCase(),
    );
    try {
      await onChange([...without, { ...draft, name }]);
      setDraft(EMPTY_SERIES);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save");
    }
  }

  return (
    <details className="rounded-xl border p-3 text-sm">
      <summary className="cursor-pointer font-medium">
        Saved series ({list.length}): the same look, voice and length every time
      </summary>
      <div className="mt-3 space-y-3">
        {list.length > 0 && (
          <ul className="space-y-1" aria-label="Saved series">
            {list.map((s) => (
              <li key={s.name} className="flex flex-wrap items-center gap-2">
                <span className="font-medium">{s.name}</span>
                <span className="text-muted-foreground text-xs">
                  {[
                    s.theme,
                    s.format,
                    s.seconds && lengthLabel(s.seconds),
                    s.music,
                  ]
                    .filter(Boolean)
                    .join(" · ") || "no defaults"}
                </span>
                <Button size="sm" variant="ghost" onClick={() => setDraft(s)}>
                  Edit
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() =>
                    void onChange(list.filter((x) => x.name !== s.name))
                  }
                >
                  Delete
                </Button>
              </li>
            ))}
          </ul>
        )}
        <div className="grid gap-2 sm:grid-cols-3">
          <label className="grid gap-1">
            Name
            <input
              value={draft.name}
              maxLength={40}
              onChange={(e) => set({ name: e.target.value })}
              className="bg-background rounded-lg border p-2"
            />
          </label>
          <label className="grid gap-1">
            Look
            <NativeSelect
              value={draft.theme ?? ""}
              onChange={(e) => set({ theme: e.target.value || undefined })}
            >
              <option value="">Automatic</option>
              {THEMES.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </NativeSelect>
          </label>
          <label className="grid gap-1">
            Format
            <NativeSelect
              value={draft.format ?? ""}
              onChange={(e) =>
                set({
                  format: (e.target.value || undefined) as Series["format"],
                })
              }
            >
              <option value="">As written</option>
              <option value="9:16">Short, 9:16</option>
              <option value="16:9">Video, 16:9</option>
              <option value="1:1">Square, 1:1</option>
            </NativeSelect>
          </label>
          <label className="grid gap-1">
            Length
            <NativeSelect
              value={draft.seconds ?? ""}
              onChange={(e) =>
                set({
                  seconds: e.target.value ? Number(e.target.value) : undefined,
                })
              }
            >
              <option value="">30 s</option>
              {[15, 30, 60, 300].map((s) => (
                <option key={s} value={s}>
                  {lengthLabel(s)}
                </option>
              ))}
            </NativeSelect>
          </label>
          <label className="grid gap-1">
            Music
            <NativeSelect
              value={draft.music ?? ""}
              onChange={(e) => set({ music: e.target.value || undefined })}
            >
              <option value="">Automatic</option>
              <option value="none">None</option>
              {MUSIC_LIBRARY.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </NativeSelect>
          </label>
          <label className="grid gap-1">
            Brand kit
            <NativeSelect
              value={draft.brandKitId ?? ""}
              onChange={(e) => set({ brandKitId: e.target.value || undefined })}
            >
              <option value="">None</option>
              {(brandKits.data ?? []).map((kit) => (
                <option key={kit.id} value={kit.id}>
                  {kit.name}
                </option>
              ))}
            </NativeSelect>
          </label>
          <label className="grid gap-1">
            Voice style
            <NativeSelect
              value={draft.voiceStyle ?? ""}
              onChange={(e) =>
                set({
                  voiceStyle: (e.target.value ||
                    undefined) as Series["voiceStyle"],
                })
              }
            >
              <option value="">Natural</option>
              {VOICE_STYLE_IDS.map((id) => (
                <option key={id} value={id}>
                  {VOICE_STYLES[id].label}
                </option>
              ))}
            </NativeSelect>
          </label>
          <div className="flex items-end gap-3">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={draft.narration !== false}
                onChange={(e) =>
                  set({ narration: e.target.checked ? undefined : false })
                }
              />
              Narrated
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={draft.stings === true}
                onChange={(e) =>
                  set({ stings: e.target.checked ? true : undefined })
                }
              />
              Intro and outro chimes
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={draft.captions !== false}
                onChange={(e) =>
                  set({ captions: e.target.checked ? undefined : false })
                }
              />
              Captions
            </label>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" onClick={() => void save()}>
            Save series
          </Button>
          {error && (
            <span role="alert" className="text-destructive">
              {error}
            </span>
          )}
        </div>
      </div>
    </details>
  );
}

/**
 * A list of topics becomes a set of videos (roadmap A7): paste topics or a CSV,
 * pick a series, and they are written and made one at a time, so the machine is
 * never asked to render two at once. Each item has its own status and a retry;
 * pause stops after the one in progress and resume carries on.
 */
export function Batch() {
  const providers = useAIProviders();
  const automation = useAutomation();
  const writer = providers.data?.find((p) => p.configured);
  const [series, setSeries] = React.useState<Series[]>([]);
  const [chosen, setChosen] = React.useState("");
  const [topicsText, setTopicsText] = React.useState("");
  const [draft, setDraft] = React.useState(true);
  const [items, setItems] = React.useState<BatchItem[]>([]);
  const [running, setRunning] = React.useState(false);
  const [paused, setPaused] = React.useState(false);
  const [message, setMessage] = React.useState<string>();

  const itemsRef = React.useRef<BatchItem[]>([]);
  const pausedRef = React.useRef(false);
  const loopRef = React.useRef(false);
  const seriesRef = React.useRef<Series | undefined>(undefined);
  const settingsRef = React.useRef({ draft, research: true, writerId: "" });

  const selected = series.find((s) => s.name === chosen);
  // The running loop reads the latest choices from refs, kept current here.
  React.useEffect(() => {
    seriesRef.current = selected;
    settingsRef.current = {
      draft,
      research: automation.research,
      writerId: writer?.id ?? "",
    };
  });

  React.useEffect(() => {
    void apiGet<{ series: Series[] }>("/api/series")
      .then((r) => setSeries(r.series))
      .catch(() => undefined);
    // A queue saved before a reload comes back; unfinished work waits again.
    // Read after mount so the server and browser render the same first page.
    void Promise.resolve().then(() => {
      try {
        const saved = restoreItems(
          JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]"),
        );
        itemsRef.current = saved;
        setItems(saved);
      } catch {
        // Nothing saved, or storage is blocked: start empty.
      }
    });
  }, []);

  function commit(next: BatchItem[]) {
    itemsRef.current = next;
    setItems(next);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      // Not saved; the queue still works in this tab.
    }
  }
  const update = (id: string, patch: Partial<BatchItem>) =>
    commit(itemsRef.current.map((i) => (i.id === id ? { ...i, ...patch } : i)));

  async function processItem(item: BatchItem) {
    const { draft: quick, research, writerId } = settingsRef.current;
    const s = seriesRef.current;
    try {
      if (!writerId)
        throw new Error(
          "No storyboard writer is set up. Add a key or a local model in Settings.",
        );
      update(item.id, { status: "writing" });
      const request = buildWriteRequest(item.topic, {
        format: s?.format ?? "9:16",
        seconds: s?.seconds ?? 30,
        research,
      });
      if (!request) throw new Error("This topic is empty");
      const written = await apiPost<{
        storyboard?: Record<string, unknown>;
        errors?: Array<{ path: string; message: string }>;
      }>("/api/storyboards/write", {
        providerId: writerId,
        ...request,
        brief: { ...request.brief, ...(s?.tone ? { tone: s.tone } : {}) },
      });
      if (!written.storyboard)
        throw new Error(
          written.errors?.map((e) => `${e.path}: ${e.message}`).join("; ") ||
            "The writer did not return a storyboard",
        );
      const params = new URLSearchParams({
        quality: quick ? "draft" : "standard",
      });
      if (s) params.set("series", s.name);
      const queued = await apiPost<{
        jobId?: string | null;
        podcastId?: string;
      }>(`/api/storyboards?${params}`, written.storyboard);
      if (!queued.jobId) throw new Error("The studio did not start the video");
      update(item.id, { status: "making", jobId: queued.jobId });
      for (;;) {
        await sleep(3000);
        const { job } = await apiGet<{
          job: { state: string; error?: string | null };
        }>(`/api/production-jobs/${queued.jobId}`);
        if (job.state === "succeeded")
          return update(item.id, { status: "done" });
        if (job.state === "failed" || job.state === "canceled")
          throw new Error(job.error || `The video was ${job.state}`);
      }
    } catch (e) {
      update(item.id, {
        status: "failed",
        error: e instanceof Error ? e.message : "Something went wrong",
      });
    }
  }

  async function runLoop() {
    if (loopRef.current) return;
    loopRef.current = true;
    setRunning(true);
    try {
      for (;;) {
        if (pausedRef.current) break;
        const next = nextItem(itemsRef.current);
        if (!next) break;
        await processItem(next);
      }
    } finally {
      loopRef.current = false;
      setRunning(false);
    }
  }

  function start() {
    const topics = parseTopics(topicsText);
    if (topics.length === 0) return setMessage("Paste at least one topic.");
    setMessage(undefined);
    commit([...itemsRef.current, ...newItems(topics)]);
    setTopicsText("");
    pausedRef.current = false;
    setPaused(false);
    void runLoop();
  }

  async function saveSeries(next: Series[]) {
    const saved = await apiPut<{ series: Series[] }>("/api/series", {
      series: next,
    });
    setSeries(saved.series);
    if (chosen && !saved.series.some((s) => s.name === chosen)) setChosen("");
  }

  async function downloadAll() {
    for (const item of itemsRef.current.filter(
      (i) => i.status === "done" && i.jobId,
    )) {
      const { job } = await apiGet<{
        job: { outputs: Array<{ format: string; downloadUrl: string }> };
      }>(`/api/production-jobs/${item.jobId}`);
      const mp4 = job.outputs.find((o) => o.format === "mp4");
      if (!mp4) continue;
      const a = document.createElement("a");
      a.href = mp4.downloadUrl;
      a.download = "";
      document.body.appendChild(a);
      a.click();
      a.remove();
      await sleep(800);
    }
  }

  const summary = summarise(items);
  const busy = isBusy(items);

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold">Make many videos</h1>
        <p className="text-muted-foreground text-sm">
          Paste topics, one per line (or a CSV; the first column is used). They
          are written and made one at a time.
        </p>
      </div>

      <SeriesEditor list={series} onChange={saveSeries} />

      <div className="space-y-3">
        <label htmlFor="batch-topics" className="text-sm font-medium">
          Topics
        </label>
        <textarea
          id="batch-topics"
          rows={6}
          value={topicsText}
          onChange={(e) => setTopicsText(e.target.value)}
          placeholder={
            "Why sleep matters\nHow rainbows form\nWhat is a black hole"
          }
          className="bg-background w-full rounded-lg border p-3 text-sm"
        />
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <label className="flex items-center gap-2">
            Series
            <NativeSelect
              aria-label="Series"
              className="w-48"
              value={chosen}
              onChange={(e) => setChosen(e.target.value)}
            >
              <option value="">None (30 s shorts)</option>
              {series.map((s) => (
                <option key={s.name} value={s.name}>
                  {s.name}
                </option>
              ))}
            </NativeSelect>
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={draft}
              onChange={(e) => setDraft(e.target.checked)}
            />
            Quick drafts
          </label>
          <Button onClick={start} disabled={!topicsText.trim()}>
            {running && <Loader2 className="size-4 animate-spin" aria-hidden />}
            Start
          </Button>
        </div>
        {providers.data && !writer && (
          <p role="note" className="text-sm">
            No storyboard writer is set up yet. Add a key or a local model in{" "}
            <Link href="/settings" className="underline">
              Settings
            </Link>
            .
          </p>
        )}
        {message && (
          <p role="status" className="text-sm">
            {message}
          </p>
        )}
      </div>

      {items.length > 0 && (
        <section aria-labelledby="batch-queue" className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <h2 id="batch-queue" className="text-lg font-semibold">
              Queue
            </h2>
            <span role="status" className="text-muted-foreground text-sm">
              {summary.done} of {summary.total} done
              {summary.failed ? ` · ${summary.failed} failed` : ""}
              {paused ? " · paused after the current one" : ""}
            </span>
            <span className="ml-auto flex gap-2">
              {paused ? (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    pausedRef.current = false;
                    setPaused(false);
                    void runLoop();
                  }}
                >
                  <Play className="size-4" aria-hidden /> Resume
                </Button>
              ) : (
                <Button
                  size="sm"
                  variant="outline"
                  disabled={!busy && summary.waiting === 0}
                  onClick={() => {
                    pausedRef.current = true;
                    setPaused(true);
                  }}
                >
                  <Pause className="size-4" aria-hidden /> Pause
                </Button>
              )}
              {summary.failed > 0 && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    commit(retryAll(itemsRef.current));
                    pausedRef.current = false;
                    setPaused(false);
                    void runLoop();
                  }}
                >
                  <RotateCcw className="size-4" aria-hidden /> Retry failed
                </Button>
              )}
              {summary.done > 0 && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => void downloadAll()}
                >
                  <Download className="size-4" aria-hidden /> Download all (
                  {summary.done})
                </Button>
              )}
            </span>
          </div>
          <ol className="space-y-2">
            {items.map((item) => (
              <li
                key={item.id}
                className="flex flex-wrap items-center gap-2 rounded-lg border p-3 text-sm"
              >
                <span className="min-w-0 flex-1 truncate font-medium">
                  {item.topic}
                </span>
                <span
                  className="text-muted-foreground"
                  data-status={item.status}
                >
                  {item.status === "waiting" &&
                    (queuePosition(items, item.id) ?? "Waiting")}
                  {item.status === "writing" && "Writing the storyboard…"}
                  {item.status === "making" && "Making the video…"}
                  {item.status === "done" && "Done"}
                  {item.status === "failed" && "Failed"}
                </span>
                {item.status === "done" && item.jobId && (
                  <Link href={`/results/${item.jobId}`} className="underline">
                    Open
                  </Link>
                )}
                {item.status === "failed" && (
                  <>
                    <span
                      role="alert"
                      className="text-destructive max-w-xs truncate"
                      title={item.error}
                    >
                      {item.error}
                    </span>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        commit(retry(itemsRef.current, item.id));
                        pausedRef.current = false;
                        setPaused(false);
                        void runLoop();
                      }}
                    >
                      Retry
                    </Button>
                  </>
                )}
              </li>
            ))}
          </ol>
          <Button
            variant="ghost"
            size="sm"
            disabled={busy}
            onClick={() =>
              commit(
                itemsRef.current.filter(
                  (i) =>
                    i.status === "waiting" ||
                    i.status === "writing" ||
                    i.status === "making",
                ),
              )
            }
          >
            Clear finished
          </Button>
        </section>
      )}
    </div>
  );
}
