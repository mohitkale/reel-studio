"use client";
import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { apiGet, apiPost } from "@/lib/api-client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  audioEditPlanSchema,
  cutAudioRange,
  encodeAudioWav,
  rebaseAudioSegments,
  waveformPeaks,
  type AudioEditPlan,
  type AudioSegment,
} from "@/lib/audio-edit-plan";

function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob),
    link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export function AudioWorkbench({
  id,
  kind = "voiceover",
  onSaved,
  url,
  title,
  segments = [],
}: {
  id: string;
  kind?: "voiceover" | "podcast";
  onSaved?(id: string): void;
  url: string;
  title: string;
  segments?: AudioSegment[];
}) {
  const qc = useQueryClient();
  const [revision, setRevision] = useState(0);
  const [buffer, setBuffer] = useState<AudioBuffer | null>(null),
    [loading, setLoading] = useState(false),
    [error, setError] = useState("");
  const [history, setHistory] = useState<AudioEditPlan[]>([]),
    [cursor, setCursor] = useState(0),
    [start, setStart] = useState(0),
    [end, setEnd] = useState(0),
    [preview, setPreview] = useState("");
  const [peaks, setPeaks] = useState<number[]>([]),
    [rendering, setRendering] = useState(false);
  const audio = useRef<HTMLAudioElement>(null),
    previewRef = useRef("");
  const previewAudio = useRef<HTMLAudioElement>(null);
  const plan = history[cursor],
    storageKey = `reel-studio:audio-edit:${id}`;
  useEffect(
    () => () => {
      if (previewRef.current) URL.revokeObjectURL(previewRef.current);
    },
    [],
  );
  async function load() {
    setLoading(true);
    setError("");
    let context: AudioContext | undefined;
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error("Audio could not be loaded");
      const limit = 128 * 1024 * 1024;
      if (Number(response.headers.get("content-length")) > limit) {
        await response.body?.cancel();
        throw new Error("Audio editing supports files up to 128 MiB");
      }
      const reader = response.body?.getReader();
      if (!reader) throw new Error("Audio response has no body");
      const chunks: Uint8Array<ArrayBuffer>[] = [];
      let size = 0;
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          size += value.byteLength;
          if (size > limit)
            throw new Error("Audio editing supports files up to 128 MiB");
          chunks.push(new Uint8Array(value));
        }
      } finally {
        await reader.cancel();
      }
      const bytes = await new Blob(chunks).arrayBuffer();
      if (bytes.byteLength > 128 * 1024 * 1024)
        throw new Error("Audio editing supports files up to 128 MiB");
      context = new AudioContext();
      const decoded = await context.decodeAudioData(bytes);
      if (decoded.duration > 1800)
        throw new Error("Audio editing supports up to 30 minutes per take");
      setBuffer(decoded);
      setPeaks(waveformPeaks(decoded.getChannelData(0)));
      setEnd(decoded.duration);
      let initial: AudioEditPlan = {
        version: 1,
        ranges: [{ start: 0, end: decoded.duration }],
        gains: {},
        cleanup: false,
      };
      try {
        const saved = localStorage.getItem(storageKey);
        if (saved) {
          const parsed = audioEditPlanSchema.safeParse(JSON.parse(saved));
          if (
            parsed.success &&
            parsed.data.ranges.every((r) => r.end <= decoded.duration)
          )
            initial = parsed.data;
        }
      } catch {}
      const saved = await apiGet<{
        session: {
          revision: number;
          history: AudioEditPlan[];
          cursor: number;
        } | null;
      }>(`/api/audio-edits?kind=${kind}&takeId=${encodeURIComponent(id)}`);
      if (saved.session) {
        setRevision(saved.session.revision);
        setHistory(saved.session.history);
        setCursor(saved.session.cursor);
      } else {
        setHistory([initial]);
        setCursor(0);
        setRevision(0);
      }
    } catch (e) {
      setBuffer(null);
      setError(e instanceof Error ? e.message : "Could not decode audio");
    } finally {
      await context?.close();
      setLoading(false);
    }
  }
  function change(next: AudioEditPlan) {
    const valid = audioEditPlanSchema.parse(next);
    setHistory([...history.slice(0, cursor + 1), valid].slice(-50));
    setCursor(Math.min(cursor + 1, 49));
    persist(valid);
  }
  function persist(value: AudioEditPlan) {
    try {
      localStorage.setItem(storageKey, JSON.stringify(value));
    } catch {
      toast.error("Audio edit could not be saved on this browser");
    }
    setPreview("");
  }
  function move(next: number) {
    setCursor(next);
    persist(history[next]);
  }
  async function render(downloadFile: boolean) {
    if (!buffer || !plan) return;
    setRendering(true);
    try {
      const length = Math.ceil(
        plan.ranges.reduce((sum, r) => sum + r.end - r.start, 0) *
          buffer.sampleRate,
      );
      const context = new OfflineAudioContext(
        Math.min(2, buffer.numberOfChannels),
        length,
        buffer.sampleRate,
      );
      let output: AudioNode = context.destination;
      if (plan.cleanup) {
        const compressor = context.createDynamicsCompressor();
        compressor.threshold.value = -18;
        compressor.ratio.value = 3;
        compressor.connect(output);
        const highpass = context.createBiquadFilter();
        highpass.type = "highpass";
        highpass.frequency.value = 80;
        highpass.connect(compressor);
        output = highpass;
      }
      let at = 0;
      for (const range of plan.ranges) {
        const source = context.createBufferSource();
        source.buffer = buffer;
        const gain = context.createGain();
        gain.gain.setValueAtTime(1, at);
        for (const s of segments) {
          const from = Math.max(range.start, s.start),
            to = Math.min(range.end, s.end);
          if (to > from) {
            gain.gain.setValueAtTime(
              plan.gains[s.speaker] ?? 1,
              at + from - range.start,
            );
            gain.gain.setValueAtTime(1, at + to - range.start);
          }
        }
        source.connect(gain);
        const envelope = context.createGain();
        const duration = range.end - range.start;
        const fade = Math.min(0.005, duration / 2);
        envelope.gain.setValueAtTime(0, at);
        envelope.gain.linearRampToValueAtTime(1, at + fade);
        envelope.gain.setValueAtTime(1, at + duration - fade);
        envelope.gain.linearRampToValueAtTime(0, at + duration);
        gain.connect(envelope);
        envelope.connect(output);
        source.start(at, range.start, range.end - range.start);
        at += range.end - range.start;
      }
      const rendered = await context.startRendering(),
        wav = new Blob(
          [
            encodeAudioWav(
              Array.from({ length: rendered.numberOfChannels }, (_, i) =>
                rendered.getChannelData(i),
              ),
              rendered.sampleRate,
            ),
          ],
          { type: "audio/wav" },
        );
      if (downloadFile)
        download(
          wav,
          `${title.replace(/[^\p{L}\p{N} _-]/gu, "").slice(0, 80) || "audio"}-edited.wav`,
        );
      else {
        if (previewRef.current) URL.revokeObjectURL(previewRef.current);
        previewRef.current = URL.createObjectURL(wav);
        setPreview(previewRef.current);
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not render audio");
    } finally {
      setRendering(false);
    }
  }
  async function saveStudio(commit: boolean) {
    if (!plan) return;
    setRendering(true);
    try {
      const saved = await apiPost<{ revision: number }>("/api/audio-edits", {
        action: "save",
        kind,
        takeId: id,
        history,
        cursor,
        expectedRevision: revision,
      });
      setRevision(saved.revision);
      if (commit) {
        const result = await apiPost<{ takeId: string }>("/api/audio-edits", {
          action: "commit",
          kind,
          takeId: id,
          revision: saved.revision,
        });
        await Promise.all([
          qc.invalidateQueries({ queryKey: ["script"] }),
          qc.invalidateQueries({ queryKey: ["podcast"] }),
          qc.invalidateQueries({ queryKey: ["projects"] }),
        ]);
        onSaved?.(result.takeId);
        toast.success("Edited take saved — available for playback and export");
      } else toast.success("Edit plan and undo history saved to the studio");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not save edits",
      );
    } finally {
      setRendering(false);
    }
  }
  return (
    <section
      className="bg-card min-w-0 space-y-3 rounded-xl border p-4"
      aria-label="Audio workbench"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-semibold">Waveform & transcript</h3>
        {!buffer && (
          <Button
            variant="outline"
            disabled={loading}
            onClick={() => void load()}
          >
            {loading ? "Loading waveform…" : "Open audio editor"}
          </Button>
        )}
      </div>
      <p className="text-muted-foreground text-xs">
        Save your plan and undo history to the studio, then save an edited take
        for playback and export. The original remains available.
      </p>
      {error && (
        <p role="alert" className="text-destructive text-sm">
          {error}
        </p>
      )}
      {buffer && plan && (
        <fieldset disabled={rendering} className="min-w-0 space-y-3">
          <svg
            role="img"
            aria-label="Source audio waveform"
            viewBox="0 0 640 80"
            className="bg-muted h-24 w-full rounded"
          >
            <rect
              x={(start / buffer.duration) * 640}
              y="0"
              width={(Math.max(0, end - start) / buffer.duration) * 640}
              height="80"
              fill="currentColor"
              opacity="0.1"
            />
            {peaks.map((peak, i) => (
              <line
                key={i}
                x1={i * 4 + 2}
                x2={i * 4 + 2}
                y1={40 - peak * 36}
                y2={40 + peak * 36}
                stroke="currentColor"
                strokeWidth="2"
              />
            ))}
          </svg>
          <audio
            ref={audio}
            src={url}
            controls
            className="w-full"
            aria-label="Original audio"
            onPlay={() => previewAudio.current?.pause()}
          />
          <div className="grid grid-cols-2 gap-3">
            <label className="text-sm">
              Selection start (seconds)
              <Input
                type="number"
                min={0}
                max={buffer.duration}
                step="0.01"
                value={start}
                onChange={(e) => setStart(Number(e.target.value))}
              />
            </label>
            <label className="text-sm">
              Selection end (seconds)
              <Input
                type="number"
                min={0}
                max={buffer.duration}
                step="0.01"
                value={end}
                onChange={(e) => setEnd(Number(e.target.value))}
              />
            </label>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              disabled={!(end > start && start >= 0 && end <= buffer.duration)}
              onClick={() => change({ ...plan, ranges: [{ start, end }] })}
            >
              Keep selection
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                try {
                  change(cutAudioRange(plan, start, end));
                } catch {
                  toast.error(
                    "Keep at least some audio; adjust the selection.",
                  );
                }
              }}
            >
              Remove selection
            </Button>
            <Button
              variant="ghost"
              disabled={cursor === 0}
              onClick={() => move(cursor - 1)}
            >
              Undo
            </Button>
            <Button
              variant="ghost"
              disabled={cursor === history.length - 1}
              onClick={() => move(cursor + 1)}
            >
              Redo
            </Button>
          </div>
          <p className="text-muted-foreground text-xs">
            {plan.ranges.length} retained clips ·{" "}
            {plan.ranges
              .reduce((sum, r) => sum + r.end - r.start, 0)
              .toFixed(1)}{" "}
            seconds
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            {[...new Set(segments.map((s) => s.speaker))].map((speaker) => (
              <label key={speaker} className="grid gap-1 text-sm">
                {speaker} level ({Math.round((plan.gains[speaker] ?? 1) * 100)}
                %)
                <input
                  type="range"
                  min="0"
                  max="2"
                  step="0.05"
                  value={plan.gains[speaker] ?? 1}
                  onChange={(e) =>
                    change({
                      ...plan,
                      gains: {
                        ...plan.gains,
                        [speaker]: Number(e.target.value),
                      },
                    })
                  }
                />
              </label>
            ))}
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={plan.cleanup}
              onChange={(e) => change({ ...plan, cleanup: e.target.checked })}
            />
            Speech cleanup: rumble filter and gentle compression
          </label>
          <div className="flex flex-wrap gap-2">
            <Button disabled={rendering} onClick={() => void saveStudio(false)}>
              Save edit plan
            </Button>
            <Button disabled={rendering} onClick={() => void saveStudio(true)}>
              Save as new take
            </Button>
            <Button
              variant="outline"
              disabled={loading || rendering}
              onClick={() => void load()}
            >
              Reload saved plan
            </Button>
            <Button disabled={rendering} onClick={() => void render(false)}>
              Audition edits
            </Button>
            <Button
              variant="outline"
              disabled={rendering}
              onClick={() => void render(true)}
            >
              Download edited WAV
            </Button>
            <Button
              variant="outline"
              onClick={() =>
                download(
                  new Blob(
                    [
                      JSON.stringify(
                        {
                          title,
                          transcriptNote:
                            "Segments marked textNeedsReview were partially cut; their text must be corrected before publishing captions.",
                          edits: plan,
                          transcript: rebaseAudioSegments(
                            segments,
                            plan.ranges,
                          ),
                        },
                        null,
                        2,
                      ),
                    ],
                    { type: "application/json" },
                  ),
                  "audio-edit-manifest.json",
                )
              }
            >
              Download edit manifest
            </Button>
          </div>
          <p className="text-muted-foreground text-xs">
            Studio revision {revision}. Review trimmed narration and captions
            before exporting video from an edited take.
          </p>
          {preview && (
            <audio
              ref={previewAudio}
              onPlay={() => audio.current?.pause()}
              src={preview}
              controls
              className="w-full"
              aria-label="Edited audio preview"
            />
          )}
          <details>
            <summary className="cursor-pointer text-sm">
              Transcript — select a passage to edit its audio
            </summary>
            <ol className="mt-2 max-h-64 space-y-2 overflow-y-auto">
              {segments.map((s, i) => (
                <li key={`${s.id}:${i}`}>
                  <button
                    className="hover:bg-muted w-full rounded border p-3 text-left text-sm"
                    onClick={() => {
                      setStart(Math.min(s.start, buffer.duration));
                      setEnd(Math.min(s.end, buffer.duration));
                      if (audio.current) audio.current.currentTime = s.start;
                    }}
                  >
                    <span className="font-medium">
                      {s.speaker} · {s.start.toFixed(1)}s
                    </span>
                    <p>{s.text}</p>
                  </button>
                </li>
              ))}
            </ol>
          </details>
        </fieldset>
      )}
    </section>
  );
}
