"use client";

import * as React from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Scissors, Upload } from "lucide-react";

import { Button } from "@/components/ui/button";
import { NativeSelect } from "@/components/ui/native-select";
import { apiGet, apiPost } from "@/lib/api-client";
import {
  fillerWordIndexes,
  type ClipSuggestion,
  type RecWord,
} from "@/lib/recording-clips";
import { THEMES } from "@/video/themes";
import {
  CHARACTERS,
  getCharacter,
} from "@/engines/hyperframes/presenter/characters";
import { PresenterPreview } from "@/components/studio/presenter-preview";
import type { ClipJob, RecordingRecord } from "@/library/recording-repurpose";

type Summary = Omit<RecordingRecord, "words">;

const clock = (seconds: number) =>
  `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, "0")}`;

/**
 * Turn a recording (a talk, a podcast, a screen capture) into captioned clips.
 * Everything runs on this computer: FFmpeg, local whisper.cpp and the local
 * HyperFrames export. Delete words in the transcript to cut them from the clip.
 */
export function Recordings() {
  const queryClient = useQueryClient();
  const list = useQuery({
    queryKey: ["recordings"],
    queryFn: () =>
      apiGet<{
        readiness: { available: boolean; reason: string | null };
        recordings: Summary[];
      }>("/api/recordings"),
    refetchInterval: (q) =>
      q.state.data?.recordings.some((r) => r.status === "transcribing")
        ? 2000
        : false,
  });
  const [openId, setOpenId] = React.useState<string>();
  const [language, setLanguage] = React.useState("auto");
  const [uploading, setUploading] = React.useState(false);
  const [error, setError] = React.useState<string>();

  async function upload(file: File) {
    setError(undefined);
    setUploading(true);
    try {
      const form = new FormData();
      form.set("file", file);
      form.set("language", language);
      const response = await fetch("/api/recordings", {
        method: "POST",
        body: form,
      });
      const json = (await response.json()) as { id?: string; error?: string };
      if (!response.ok || !json.id)
        throw new Error(json.error ?? `HTTP ${response.status}`);
      setOpenId(json.id);
      await queryClient.invalidateQueries({ queryKey: ["recordings"] });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not import the file");
    } finally {
      setUploading(false);
    }
  }

  const ready = list.data?.readiness;
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">
          Turn a recording into clips
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Import a talk, a podcast or a screen capture. It is transcribed on
          this computer, the best moments are suggested, and each clip gets a
          hook title and word-by-word captions. Nothing is uploaded.
        </p>
      </div>
      {ready && !ready.available && (
        <p role="alert" className="text-destructive text-sm">
          {ready.reason}
        </p>
      )}
      <section
        className="bg-card space-y-3 rounded-xl border p-4"
        aria-label="Import a recording"
      >
        <div className="flex flex-wrap items-end gap-3 text-sm">
          <label className="grid gap-1">
            Language
            <NativeSelect
              aria-label="Spoken language"
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
            >
              <option value="auto">Detect</option>
              <option value="en">English</option>
              <option value="es">Spanish</option>
              <option value="fr">French</option>
              <option value="de">German</option>
              <option value="hi">Hindi</option>
              <option value="pt">Portuguese</option>
            </NativeSelect>
          </label>
          <label className="focus-within:outline-ring inline-flex min-h-10 cursor-pointer items-center gap-2 rounded-md border px-4 font-medium focus-within:outline-2">
            {uploading ? (
              <Loader2 className="size-4 animate-spin" aria-hidden />
            ) : (
              <Upload className="size-4" aria-hidden />
            )}
            Choose an audio or video file
            <input
              type="file"
              accept="audio/*,video/*,.mkv"
              className="sr-only"
              disabled={uploading || ready?.available === false}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void upload(file);
                e.target.value = "";
              }}
            />
          </label>
        </div>
        {error && (
          <p role="alert" className="text-destructive text-sm">
            {error}
          </p>
        )}
      </section>
      {list.data && list.data.recordings.length > 0 && (
        <ul className="grid gap-2 sm:grid-cols-2" aria-label="Your recordings">
          {list.data.recordings.map((r) => (
            <li key={r.id}>
              <button
                type="button"
                onClick={() => setOpenId(r.id)}
                aria-pressed={openId === r.id}
                className={`focus-visible:outline-ring w-full rounded-lg border p-3 text-left text-sm focus-visible:outline-2 ${openId === r.id ? "border-primary bg-primary/5" : "bg-card hover:bg-muted"}`}
              >
                <span className="block truncate font-medium">{r.name}</span>
                <span className="text-muted-foreground text-xs">
                  {clock(r.duration)} · {r.hasVideo ? "video" : "audio"} ·{" "}
                  {r.status === "transcribing"
                    ? "transcribing…"
                    : r.status === "failed"
                      ? "failed"
                      : "ready"}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {openId && <RecordingView key={openId} id={openId} />}
    </div>
  );
}

function RecordingView({ id }: { id: string }) {
  const detail = useQuery({
    queryKey: ["recording", id],
    queryFn: () =>
      apiGet<{ recording: RecordingRecord; suggestions: ClipSuggestion[] }>(
        `/api/recordings/${id}`,
      ),
    refetchInterval: (q) =>
      q.state.data?.recording.status === "transcribing" ? 2000 : false,
  });
  const [chosen, setChosen] = React.useState<number[]>();
  const [removed, setRemoved] = React.useState<Set<number>>(new Set());
  const [trimSilence, setTrimSilence] = React.useState(true);
  const [removeFillers, setRemoveFillers] = React.useState(true);
  const [format, setFormat] = React.useState<"9:16" | "1:1" | "16:9">("9:16");
  const [reframe, setReframe] = React.useState<"blur" | "fill">("blur");
  const [theme, setTheme] = React.useState("bold-pop");
  const [presenterId, setPresenterId] = React.useState("");
  const [chosenPlacement, setPlacement] = React.useState<
    "full" | "corner" | "split" | undefined
  >();
  const [job, setJob] = React.useState<ClipJob | null>(null);
  const [error, setError] = React.useState<string>();

  const recording = detail.data?.recording;
  const suggestions = detail.data?.suggestions ?? [];
  const selected = chosen ?? suggestions.map((_, i) => i);

  const running = job?.state === "running";
  React.useEffect(() => {
    if (!running) return;
    const timer = setInterval(() => {
      void apiGet<{ job: ClipJob | null }>(`/api/recordings/${id}/clips`).then(
        (r) => setJob(r.job),
      );
    }, 1500);
    return () => clearInterval(timer);
  }, [running, id]);

  const fillers = React.useMemo(
    () => (recording ? fillerWordIndexes(recording.words) : new Set<number>()),
    [recording],
  );

  if (!recording) return <p role="status">Opening…</p>;
  if (recording.status === "transcribing")
    return (
      <p role="status" className="flex items-center gap-2 text-sm">
        <Loader2 className="size-4 animate-spin" aria-hidden /> Transcribing{" "}
        {recording.name} on this computer…
      </p>
    );
  if (recording.status === "failed")
    return (
      <p role="alert" className="text-destructive text-sm">
        Could not transcribe {recording.name}: {recording.error}
      </p>
    );

  const words: RecWord[] = recording.words;
  // A recording with video gets a corner bubble by default; audio gets the full frame.
  const placement = chosenPlacement ?? (recording.hasVideo ? "corner" : "full");
  const inClip = (index: number) =>
    selected.some(
      (i) =>
        suggestions[i] &&
        index >= suggestions[i]!.startWord &&
        index <= suggestions[i]!.endWord,
    );

  async function make() {
    setError(undefined);
    try {
      const response = await apiPost<{ job: ClipJob }>(
        `/api/recordings/${id}/clips`,
        {
          clips: selected.map((i) => ({
            startWord: suggestions[i]!.startWord,
            endWord: suggestions[i]!.endWord,
            title: suggestions[i]!.title,
          })),
          removed: [...removed],
          trimSilence,
          removeFillers,
          format,
          reframe,
          theme,
          ...(presenterId
            ? { presenter: { character: presenterId, placement } }
            : {}),
          quality: "standard",
        },
      );
      setJob(response.job);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not start the clips");
    }
  }

  return (
    <div className="space-y-6">
      <section aria-labelledby="suggested-heading" className="space-y-3">
        <h2 id="suggested-heading" className="text-lg font-semibold">
          Suggested clips
        </h2>
        {suggestions.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            No complete 20 to 55 second passage was found. The recording may be
            too short.
          </p>
        ) : (
          <ul className="space-y-2">
            {suggestions.map((clip, i) => (
              <li
                key={clip.startWord}
                className="bg-card flex gap-3 rounded-lg border p-3 text-sm"
              >
                <input
                  type="checkbox"
                  aria-label={`Make clip ${i + 1}`}
                  className="mt-1"
                  checked={selected.includes(i)}
                  onChange={(e) =>
                    setChosen(
                      e.target.checked
                        ? [...selected, i]
                        : selected.filter((n) => n !== i),
                    )
                  }
                />
                <div className="min-w-0">
                  <p className="font-medium">{clip.title}</p>
                  <p className="text-muted-foreground text-xs">
                    {clock(clip.start)} to {clock(clip.end)} ·{" "}
                    {Math.round(clip.seconds)} s · {clip.reasons.join(", ")}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="transcript-heading" className="space-y-2">
        <h2 id="transcript-heading" className="text-lg font-semibold">
          Transcript
        </h2>
        <p className="text-muted-foreground text-xs">
          Click a word to cut it from the clips (click again to bring it back).
          Words in a suggested clip are shaded.{" "}
          {fillers.size > 0 &&
            `${fillers.size} filler sound${fillers.size === 1 ? "" : "s"} found.`}
        </p>
        <div
          className="bg-card max-h-72 overflow-y-auto rounded-lg border p-3 text-sm leading-7"
          role="group"
          aria-label="Transcript words"
        >
          {words.map((word, index) => (
            <button
              key={index}
              type="button"
              aria-pressed={removed.has(index)}
              title={clock(word.start)}
              onClick={() =>
                setRemoved((current) => {
                  const next = new Set(current);
                  if (!next.delete(index)) next.add(index);
                  return next;
                })
              }
              className={`focus-visible:outline-ring mr-1 rounded px-0.5 focus-visible:outline-2 ${removed.has(index) ? "text-muted-foreground line-through" : inClip(index) ? "bg-primary/15" : ""} ${fillers.has(index) ? "underline decoration-dotted" : ""}`}
            >
              {word.text}
            </button>
          ))}
        </div>
        {removed.size > 0 && (
          <p className="text-muted-foreground text-xs">
            {removed.size} words will be cut.
          </p>
        )}
      </section>

      <section aria-labelledby="options-heading" className="space-y-3">
        <h2 id="options-heading" className="text-lg font-semibold">
          Options
        </h2>
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={trimSilence}
              onChange={(e) => setTrimSilence(e.target.checked)}
            />
            Trim long silences
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={removeFillers}
              onChange={(e) => setRemoveFillers(e.target.checked)}
            />
            Remove “um” and “uh”
          </label>
          <label className="flex items-center gap-2">
            Size
            <NativeSelect
              aria-label="Size"
              value={format}
              onChange={(e) => setFormat(e.target.value as typeof format)}
            >
              <option value="9:16">Vertical 9:16</option>
              <option value="1:1">Square 1:1</option>
              <option value="16:9">Wide 16:9</option>
            </NativeSelect>
          </label>
          {recording.hasVideo && (
            <label className="flex items-center gap-2">
              Fit
              <NativeSelect
                aria-label="Fit"
                value={reframe}
                onChange={(e) => setReframe(e.target.value as typeof reframe)}
              >
                <option value="blur">
                  Whole picture on a blurred background
                </option>
                <option value="fill">Crop to the middle</option>
              </NativeSelect>
            </label>
          )}
          <label className="flex items-center gap-2">
            Look
            <NativeSelect
              aria-label="Look"
              value={theme}
              onChange={(e) => setTheme(e.target.value)}
            >
              {THEMES.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </NativeSelect>
          </label>
        </div>
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
          <label className="flex items-center gap-2">
            Presenter
            <NativeSelect
              aria-label="Presenter"
              value={presenterId}
              onChange={(e) => setPresenterId(e.target.value)}
            >
              <option value="">None</option>
              {CHARACTERS.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.style})
                </option>
              ))}
            </NativeSelect>
          </label>
          {presenterId && (
            <label className="flex items-center gap-2">
              Where
              <NativeSelect
                aria-label="Presenter placement"
                value={placement}
                onChange={(e) =>
                  setPlacement(e.target.value as "full" | "corner" | "split")
                }
              >
                <option value="full">Full frame</option>
                <option value="corner">Corner bubble</option>
                {recording.hasVideo && (
                  <option value="split">Split screen with the video</option>
                )}
              </NativeSelect>
            </label>
          )}
        </div>
        {presenterId && getCharacter(presenterId) && (
          <div className="flex items-center gap-3 text-xs">
            <PresenterPreview character={getCharacter(presenterId)!} />
            <p className="text-muted-foreground max-w-sm">
              {getCharacter(presenterId)!.description} The mouth follows the
              words and the audio, and the character blinks and nods. The
              preview steps through all twelve mouth shapes.
            </p>
          </div>
        )}
        <Button
          onClick={() => void make()}
          disabled={running || selected.length === 0}
        >
          {running ? (
            <Loader2 className="size-4 animate-spin" aria-hidden />
          ) : (
            <Scissors className="size-4" aria-hidden />
          )}
          Make {selected.length} clip{selected.length === 1 ? "" : "s"}
        </Button>
        {error && (
          <p role="alert" className="text-destructive text-sm">
            {error}
          </p>
        )}
      </section>

      {job && (
        <section aria-labelledby="clips-heading" className="space-y-3">
          <h2 id="clips-heading" className="text-lg font-semibold">
            Your clips
          </h2>
          <p role="status" className="text-sm">
            {job.state === "running" &&
              `${job.step} (${job.finished} of ${job.total} done)`}
            {job.state === "done" &&
              `Done: ${job.results.length} clip${job.results.length === 1 ? "" : "s"}.`}
            {job.state === "failed" && (
              <span className="text-destructive">{job.error}</span>
            )}
          </p>
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {job.results.map((clip) => (
              <li
                key={clip.assetId}
                className="bg-card space-y-2 rounded-lg border p-3 text-sm"
              >
                <video
                  src={clip.url}
                  controls
                  className="w-full rounded"
                  aria-label={clip.title}
                />
                <p className="font-medium">{clip.title}</p>
                <p className="text-muted-foreground text-xs">
                  {Math.round(clip.seconds)} s · {clip.kit.hashtags.join(" ")}
                </p>
                <div className="flex flex-wrap gap-2">
                  <Button asChild variant="outline" size="sm">
                    <a href={clip.url} download>
                      Download MP4
                    </a>
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() =>
                      void navigator.clipboard?.writeText(
                        `${clip.kit.title}\n\n${clip.kit.description}\n\n${clip.kit.hashtags.join(" ")}`,
                      )
                    }
                  >
                    Copy title and hashtags
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
