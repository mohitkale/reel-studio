"use client";

import * as React from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2, Mic, Square, Upload, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { apiGet } from "@/lib/api-client";
import { audioBlobToWavFile } from "@/lib/client-tts/wav-encode";
import {
  voiceforgeEngineHelperText,
  voiceforgeEngineOptionLabel,
} from "@/providers/voice/voiceforge-engines";
import { AudioPreview } from "@/components/voice/audio-preview";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

interface VoiceforgeEngine {
  id: string;
  label: string;
  ready: boolean;
  capabilities?: {
    zero_shot: boolean;
    fine_tunable: boolean;
    min_sample_seconds: number;
    recommended_sample_seconds: number;
    requires_gpu: boolean;
    license: string;
  };
}

interface VoiceforgeVoice {
  id: string;
  name: string;
  engineId: string;
  tier: "instant" | "high_fidelity";
  status: "processing" | "ready" | "failed";
  errorMessage?: string | null;
}

type ClonePhase = "idle" | "processing" | "ready" | "failed";

/** Neutral script (~20–30s at a calm pace) for consistent clone samples. */
const SAMPLE_READ_SCRIPT =
  "Hello, this is my voice sample for cloning. I'm speaking clearly at a natural pace. " +
  "The quick brown fox jumps over the lazy dog. Today feels calm, and I'm reading this " +
  "so the model can learn how I sound. Please use this recording only with my permission.";

function pickDefaultEngine(
  engines: VoiceforgeEngine[],
  preferred?: string,
): string {
  const ready = engines.filter((e) => e.ready);
  if (preferred && ready.some((e) => e.id === preferred)) return preferred;
  return ready.find((e) => e.id === "xtts-v2")?.id ?? ready[0]?.id ?? "";
}

/** Target capture length from engine guidance + quality tier. */
function targetSampleSeconds(
  tier: "instant" | "high_fidelity",
  caps?: VoiceforgeEngine["capabilities"],
): number {
  const recommended = caps?.recommended_sample_seconds ?? 20;
  const minimum = caps?.min_sample_seconds ?? 10;
  if (tier === "high_fidelity") {
    return Math.max(recommended * 2, minimum, 45);
  }
  return Math.max(recommended, minimum);
}

function formatClock(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const m = Math.floor(s / 60);
  const rem = s % 60;
  return `${m}:${rem.toString().padStart(2, "0")}`;
}

async function waitForVoiceReady(voiceId: string): Promise<VoiceforgeVoice> {
  return new Promise((resolve, reject) => {
    const es = new EventSource(`/api/voiceforge/voices/${voiceId}/events`);

    const handleEvent = (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data as string) as {
          status?: string;
          message?: string;
        };
        if (data.status === "ready") {
          cleanup();
          void apiGet<{ voice: VoiceforgeVoice }>(
            `/api/voiceforge/voices/${voiceId}`,
          ).then(({ voice }) => resolve(voice));
        } else if (data.status === "failed") {
          cleanup();
          reject(new Error(data.message || "Voice cloning failed"));
        }
      } catch {
        // ignore malformed events
      }
    };

    function cleanup() {
      es.removeEventListener("status", handleEvent);
      es.onmessage = null;
      es.close();
    }

    // VoiceForge emits `event: status` (not the default "message" type).
    es.addEventListener("status", handleEvent);
    es.onmessage = handleEvent;

    es.onerror = () => {
      cleanup();
      void apiGet<{ voice: VoiceforgeVoice }>(
        `/api/voiceforge/voices/${voiceId}`,
      )
        .then(({ voice }) => {
          if (voice.status === "ready") resolve(voice);
          else if (voice.status === "failed") {
            reject(new Error(voice.errorMessage || "Voice cloning failed"));
          } else {
            reject(new Error("Lost connection while cloning the voice"));
          }
        })
        .catch(() => reject(new Error("Lost connection while cloning the voice")));
    };
  });
}

/** Upload or record reference audio and clone a voice via the VoiceForge proxy. */
export function VoiceClonePanel({
  configured,
  compact = false,
  preferredEngineId,
  onSuccess,
}: {
  configured: boolean;
  /** Omit outer Card chrome when embedded in a dialog. */
  compact?: boolean;
  /** Prefer this engine when the clone form loads (must be ready). */
  preferredEngineId?: string;
  onSuccess?: () => void;
}) {
  const qc = useQueryClient();
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const recorderRef = React.useRef<MediaRecorder | null>(null);
  const chunksRef = React.useRef<Blob[]>([]);
  const streamRef = React.useRef<MediaStream | null>(null);
  const startedAtRef = React.useRef<number | null>(null);
  const autoStopRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const previewUrlRef = React.useRef<string | null>(null);

  const [engines, setEngines] = React.useState<VoiceforgeEngine[]>([]);
  const [enginesLoading, setEnginesLoading] = React.useState(false);
  const [name, setName] = React.useState("");
  const [engineId, setEngineId] = React.useState("");
  const [tier, setTier] = React.useState<"instant" | "high_fidelity">("instant");
  const [consent, setConsent] = React.useState(false);
  const [audioFile, setAudioFile] = React.useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = React.useState<string | null>(null);
  const [recording, setRecording] = React.useState(false);
  const [elapsedSec, setElapsedSec] = React.useState(0);
  const [recordedSec, setRecordedSec] = React.useState<number | null>(null);
  const [phase, setPhase] = React.useState<ClonePhase>("idle");
  const [progressMessage, setProgressMessage] = React.useState("");

  React.useEffect(() => {
    if (!configured) return;
    setEnginesLoading(true);
    void apiGet<{ engines: VoiceforgeEngine[] }>("/api/voiceforge/engines")
      .then(({ engines: list }) => {
        setEngines(list);
        setEngineId(pickDefaultEngine(list, preferredEngineId));
      })
      .catch((e) =>
        toast.error("Could not load VoiceForge engines", {
          description: (e as Error).message,
        }),
      )
      .finally(() => setEnginesLoading(false));
  }, [configured, preferredEngineId]);

  React.useEffect(() => {
    return () => {
      if (autoStopRef.current) clearTimeout(autoStopRef.current);
      recorderRef.current?.stop();
      streamRef.current?.getTracks().forEach((t) => t.stop());
      if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    };
  }, []);

  React.useEffect(() => {
    if (!recording) return;
    const tick = window.setInterval(() => {
      if (startedAtRef.current == null) return;
      setElapsedSec((Date.now() - startedAtRef.current) / 1000);
    }, 200);
    return () => clearInterval(tick);
  }, [recording]);

  function clearAudio() {
    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current);
      previewUrlRef.current = null;
    }
    setPreviewUrl(null);
    setAudioFile(null);
    setRecordedSec(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function setCapturedAudio(file: File, durationSec?: number) {
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    const url = URL.createObjectURL(file);
    previewUrlRef.current = url;
    setPreviewUrl(url);
    setAudioFile(file);
    setRecordedSec(durationSec ?? null);
  }

  if (!configured) {
    const unconfigured = (
      <>
        <p className="text-sm font-medium">Clone a voice</p>
        <p className="text-sm text-muted-foreground">
          Set <code className="text-xs">VOICEFORGE_SERVICE_URL</code> in
          .env.local and run VoiceForge locally to enable cloning.
        </p>
      </>
    );
    if (compact) return unconfigured;
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Clone a voice</CardTitle>
          <CardDescription>
            Set <code className="text-xs">VOICEFORGE_SERVICE_URL</code> in
            .env.local and run VoiceForge locally to enable cloning.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const selectedEngine = engines.find((e) => e.id === engineId);
  const readyEngines = engines.filter((e) => e.ready);
  const targetSec = targetSampleSeconds(tier, selectedEngine?.capabilities);
  const minSec = selectedEngine?.capabilities?.min_sample_seconds ?? 10;

  function finishRecording() {
    if (autoStopRef.current) {
      clearTimeout(autoStopRef.current);
      autoStopRef.current = null;
    }
    const recorder = recorderRef.current;
    if (!recorder || recorder.state === "inactive") return;
    recorder.stop();
    recorderRef.current = null;
  }

  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      chunksRef.current = [];
      clearAudio();

      const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : MediaRecorder.isTypeSupported("audio/webm")
          ? "audio/webm"
          : undefined;
      const recorder = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream);
      recorderRef.current = recorder;

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
        const wallDuration =
          startedAtRef.current != null
            ? (Date.now() - startedAtRef.current) / 1000
            : undefined;
        startedAtRef.current = null;
        const blob = new Blob(chunksRef.current, {
          type: recorder.mimeType || "audio/webm",
        });
        setRecording(false);
        setElapsedSec(0);

        // MediaRecorder produces WebM/Opus; VoiceForge's soundfile stack cannot
        // decode that — convert to PCM WAV in the browser before upload.
        void audioBlobToWavFile(blob, "recording.wav")
          .then(({ file, durationSeconds }) => {
            setCapturedAudio(file, durationSeconds);
            if (durationSeconds < minSec) {
              toast.message("Recording is shorter than recommended", {
                description: `Aim for about ${targetSec}s (minimum ~${minSec}s for this engine).`,
              });
            } else {
              toast.success("Sample recorded", {
                description: `${formatClock(durationSeconds)} WAV captured — play it back to confirm.`,
              });
            }
          })
          .catch((err) => {
            toast.error("Could not process recording", {
              description:
                (err as Error).message ||
                "Try uploading a WAV/MP3 file instead.",
            });
            // Fall back to wall-clock note if decode failed (should be rare).
            if (wallDuration != null) {
              console.warn(
                "[voice-clone] WAV encode failed after",
                wallDuration,
                "s recording",
                err,
              );
            }
          });
      };

      startedAtRef.current = Date.now();
      setElapsedSec(0);
      recorder.start(250);
      setRecording(true);

      autoStopRef.current = setTimeout(() => {
        finishRecording();
      }, targetSec * 1000);
    } catch (e) {
      toast.error("Microphone access denied", {
        description: (e as Error).message,
      });
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !engineId || !audioFile || !consent) return;

    setPhase("processing");
    setProgressMessage("Uploading sample…");

    try {
      const formData = new FormData();
      formData.append("name", name.trim());
      formData.append("engine_id", engineId);
      formData.append("tier", tier);
      formData.append("consent", "true");
      formData.append("language", "en");
      formData.append("files", audioFile, audioFile.name);

      const res = await fetch("/api/voiceforge/voices", {
        method: "POST",
        body: formData,
      });
      const json = (await res.json().catch(() => ({}))) as {
        voice?: VoiceforgeVoice;
        error?: string;
      };
      if (!res.ok) {
        throw new Error(json.error || `Request failed (HTTP ${res.status})`);
      }

      const voice = json.voice!;
      if (voice.status === "ready") {
        setPhase("ready");
        setProgressMessage("Voice is ready.");
      } else {
        setProgressMessage("Processing on VoiceForge…");
        await waitForVoiceReady(voice.id);
        setPhase("ready");
        setProgressMessage("Voice is ready.");
      }

      toast.success(`Cloned “${name.trim()}”`);
      setName("");
      clearAudio();
      setConsent(false);
      setPhase("idle");
      setProgressMessage("");
      await qc.invalidateQueries({ queryKey: ["voices", "voiceforge"] });
      onSuccess?.();
    } catch (err) {
      setPhase("failed");
      setProgressMessage((err as Error).message);
      toast.error("Could not clone voice", {
        description: (err as Error).message,
      });
    }
  }

  const busy = phase === "processing";
  const progressPct = recording
    ? Math.min(100, (elapsedSec / targetSec) * 100)
    : 0;

  const form = (
    <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
      <div className="grid gap-2">
        <Label htmlFor="clone-name">Voice name</Label>
        <Input
          id="clone-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. My narration voice"
          disabled={busy || recording}
          required
        />
      </div>

      <div className="grid gap-2">
        <Label htmlFor="clone-engine">Engine</Label>
        <NativeSelect
          id="clone-engine"
          value={engineId}
          onChange={(e) => setEngineId(e.target.value)}
          disabled={busy || recording || enginesLoading || readyEngines.length === 0}
          required
        >
          {readyEngines.length === 0 ? (
            <option value="">No engines ready</option>
          ) : (
            readyEngines.map((engine) => (
              <option key={engine.id} value={engine.id}>
                {voiceforgeEngineOptionLabel(engine.id, engine.label)}
              </option>
            ))
          )}
        </NativeSelect>
        <p className="text-xs text-muted-foreground">
          {selectedEngine?.capabilities?.recommended_sample_seconds != null
            ? `Recommended sample: ${selectedEngine.capabilities.recommended_sample_seconds}s. `
            : ""}
          {voiceforgeEngineHelperText(
            engineId,
            selectedEngine?.capabilities?.license,
          )}
        </p>
      </div>

      <div className="grid gap-2">
        <Label htmlFor="clone-tier">Quality tier</Label>
        <NativeSelect
          id="clone-tier"
          value={tier}
          onChange={(e) =>
            setTier(e.target.value as "instant" | "high_fidelity")
          }
          disabled={busy || recording}
        >
          <option value="instant">Instant (zero-shot)</option>
          <option value="high_fidelity">High fidelity (training)</option>
        </NativeSelect>
        <p className="text-xs text-muted-foreground">
          {tier === "instant"
            ? `Zero-shot clone from a short sample. Recording auto-stops at ~${targetSec}s.`
            : `Higher quality may train longer. Recording auto-stops at ~${targetSec}s — speak clearly for the full take.`}
        </p>
      </div>

      <div className="grid gap-2">
        <Label>Reference audio</Label>
        <div className="rounded-md border bg-muted/30 px-3 py-2.5">
          <p className="text-xs font-medium text-foreground">Read aloud</p>
          <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
            {SAMPLE_READ_SCRIPT}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept="audio/*"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              const needsConvert =
                !file.type.includes("wav") &&
                !file.name.toLowerCase().endsWith(".wav");
              if (!needsConvert) {
                setCapturedAudio(file);
                toast.success("Sample selected", {
                  description: "Play it back to confirm before cloning.",
                });
                return;
              }
              // Browser picks (WebM/M4A/etc.) → WAV so VoiceForge/libsndfile can read them.
              void audioBlobToWavFile(file, "upload.wav")
                .then(({ file: wav, durationSeconds }) => {
                  setCapturedAudio(wav, durationSeconds);
                  toast.success("Sample selected", {
                    description: `Converted to WAV (${formatClock(durationSeconds)}) — play it back to confirm.`,
                  });
                })
                .catch((err) => {
                  toast.error("Could not read that audio file", {
                    description:
                      (err as Error).message ||
                      "Try a WAV or MP3 instead.",
                  });
                });
            }}
          />
          <Button
            type="button"
            variant="outline"
            disabled={busy || recording}
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload className="mr-2 size-4" />
            Upload file
          </Button>
          {!recording ? (
            <Button
              type="button"
              variant="outline"
              disabled={busy}
              onClick={() => void startRecording()}
            >
              <Mic className="mr-2 size-4" />
              Record ~{targetSec}s
            </Button>
          ) : (
            <Button type="button" variant="destructive" onClick={finishRecording}>
              <Square className="mr-2 size-4" />
              Stop
            </Button>
          )}
          {audioFile && !recording ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={busy}
              onClick={clearAudio}
            >
              <Trash2 className="mr-2 size-4" />
              Clear
            </Button>
          ) : null}
        </div>

        {recording ? (
          <div className="space-y-2 rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2.5">
            <div className="flex items-center justify-between gap-2 text-sm">
              <span className="flex items-center gap-2 font-medium text-destructive">
                <span className="relative flex size-2">
                  <span className="absolute inline-flex size-full animate-ping rounded-full bg-destructive opacity-60" />
                  <span className="relative inline-flex size-2 rounded-full bg-destructive" />
                </span>
                Recording…
              </span>
              <span className="tabular-nums text-muted-foreground">
                {formatClock(elapsedSec)} / {formatClock(targetSec)}
              </span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-destructive transition-[width] duration-200"
                style={{ width: `${progressPct}%` }}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Keep reading the sample text. Recording stops automatically at{" "}
              {formatClock(targetSec)}, or press Stop early.
            </p>
          </div>
        ) : null}

        {audioFile && !recording ? (
          <div className="flex items-center gap-3 rounded-md border bg-card px-3 py-2">
            <AudioPreview url={previewUrl ?? undefined} label={audioFile.name} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">
                {recordedSec != null ? "Recording ready" : "Sample ready"}
              </p>
              <p className="text-xs text-muted-foreground">
                {audioFile.name} · {Math.round(audioFile.size / 1024)} KB
                {recordedSec != null
                  ? ` · ${formatClock(recordedSec)}`
                  : ""}
                {recordedSec != null && recordedSec < minSec
                  ? ` · below ~${minSec}s minimum`
                  : ""}
              </p>
            </div>
          </div>
        ) : !recording ? (
          <p className="text-xs text-muted-foreground">
            Upload WAV/MP3/M4A/WebM, or record about {targetSec}s of clean speech
            using the script above.
          </p>
        ) : null}
      </div>

      <label className="flex items-start gap-2 text-sm">
        <input
          type="checkbox"
          className="mt-1"
          checked={consent}
          onChange={(e) => setConsent(e.target.checked)}
          disabled={busy || recording}
          required
        />
        <span>
          I confirm I have the right to clone and use this voice (consent
          required by VoiceForge).
        </span>
      </label>

      {progressMessage ? (
        <div className="flex items-center gap-2 rounded-md border bg-muted/40 px-3 py-2 text-sm">
          {busy ? <Loader2 className="size-4 animate-spin" /> : null}
          <span
            className={
              phase === "failed" ? "text-destructive" : "text-muted-foreground"
            }
          >
            {progressMessage}
          </span>
        </div>
      ) : null}

      <Button
        type="submit"
        disabled={
          busy ||
          recording ||
          !name.trim() ||
          !engineId ||
          !audioFile ||
          !consent ||
          readyEngines.length === 0
        }
      >
        {busy ? (
          <>
            <Loader2 className="mr-2 size-4 animate-spin" />
            Cloning…
          </>
        ) : (
          "Clone voice"
        )}
      </Button>
    </form>
  );

  if (compact) return form;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Clone a voice</CardTitle>
        <CardDescription>
          Record or upload clean speech. VoiceForge runs locally; your sample
          never leaves your machine except to the VoiceForge service you
          configured.
        </CardDescription>
      </CardHeader>
      <CardContent>{form}</CardContent>
    </Card>
  );
}
