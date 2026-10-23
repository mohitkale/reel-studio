"use client";
import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useLocalTranscriptionStatus } from "@/hooks/script";
import { toast } from "sonner";
import { encodeAudioWav } from "@/lib/audio-edit-plan";
import { Button } from "@/components/ui/button";
export function PodcastAudioImport({ podcastId }: { podcastId: string }) {
  const transcription = useLocalTranscriptionStatus();
  const [autoTranscribe, setAutoTranscribe] = useState(false);
  const qc = useQueryClient(),
    recorder = useRef<MediaRecorder | null>(null),
    stream = useRef<MediaStream | null>(null),
    timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mounted = useRef(true);
  const permissionAttempt = useRef(0);
  const [requestingMic, setRequestingMic] = useState(false);
  const cancel = useRef<AbortController | null>(null);
  const [phase, setPhase] = useState("Importing…");
  const [busy, setBusy] = useState(false),
    [recording, setRecording] = useState(false);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      cancel.current?.abort();
      if (timer.current) clearTimeout(timer.current);
      if (recorder.current?.state === "recording") {
        recorder.current.onstop = null;
        recorder.current.stop();
      }
      stream.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);
  async function upload(blob: Blob) {
    setBusy(true);
    setPhase("Importing…");
    const controller = new AbortController();
    cancel.current = controller;
    let context: AudioContext | undefined;
    try {
      if (blob.size > 96 * 1024 * 1024)
        throw new Error("Choose audio smaller than 96 MiB");
      context = new AudioContext();
      const audio = await context.decodeAudioData(await blob.arrayBuffer());
      if (audio.duration > 900)
        throw new Error("Choose a recording up to 15 minutes");
      const offline = new OfflineAudioContext(
          1,
          Math.ceil(audio.duration * 44100),
          44100,
        ),
        source = offline.createBufferSource();
      source.buffer = audio;
      source.connect(offline.destination);
      source.start();
      const rendered = await offline.startRendering();
      const response = await fetch(`/api/podcasts/${podcastId}/import-audio`, {
        method: "POST",
        signal: controller.signal,
        headers: { "Content-Type": "audio/wav" },
        body: encodeAudioWav([rendered.getChannelData(0)], 44100),
      });
      if (!response.ok) {
        const result = await response.json();
        throw new Error(result.error ?? "Import failed");
      }
      const saved = await response.json();
      await qc.invalidateQueries({ queryKey: ["podcast", podcastId] });
      toast.success("Recording imported");
      if (autoTranscribe) {
        setPhase("Transcribing locally…");
        const result = await fetch(
          `/api/podcast-takes/${saved.take.id}/transcribe`,
          {
            method: "POST",
            signal: controller.signal,
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "transcribe", language: "auto" }),
          },
        );
        if (!result.ok)
          throw new Error(
            "Recording was saved. Local transcription failed; retry from the take's transcript controls.",
          );
        await qc.invalidateQueries({ queryKey: ["podcast", podcastId] });
        toast.success("Local transcript saved — review before publishing");
      }
    } catch (error) {
      if (!controller.signal.aborted)
        toast.error(
          error instanceof Error ? error.message : "Could not import audio",
        );
    } finally {
      await context?.close();
      if (mounted.current) setBusy(false);
      cancel.current = null;
    }
  }
  async function record() {
    const attempt = ++permissionAttempt.current;
    setRequestingMic(true);
    setPhase("Waiting for microphone permission…");
    setBusy(true);
    try {
      const acquired = await navigator.mediaDevices.getUserMedia({
        audio: true,
      });
      if (!mounted.current || attempt !== permissionAttempt.current) {
        acquired.getTracks().forEach((t) => t.stop());
        return;
      }
      stream.current = acquired;
      setRequestingMic(false);
      const next = new MediaRecorder(acquired);
      recorder.current = next;
      const chunks: Blob[] = [];
      let bytes = 0;
      next.ondataavailable = (event) => {
        chunks.push(event.data);
        bytes += event.data.size;
        if (bytes > 90 * 1024 * 1024 && next.state === "recording") next.stop();
      };
      next.onstop = () => {
        if (timer.current) clearTimeout(timer.current);
        stream.current?.getTracks().forEach((t) => t.stop());
        setRecording(false);
        void upload(new Blob(chunks, { type: next.mimeType }));
      };
      next.start(1000);
      setRecording(true);
      timer.current = setTimeout(() => {
        if (next.state === "recording") next.stop();
      }, 890000);
    } catch (error) {
      if (mounted.current && attempt === permissionAttempt.current) {
        stream.current?.getTracks().forEach((t) => t.stop());
        toast.error(
          error instanceof Error ? error.message : "Microphone unavailable",
        );
      }
    } finally {
      if (mounted.current && attempt === permissionAttempt.current) {
        setRequestingMic(false);
        setBusy(false);
      }
    }
  }
  return (
    <section className="space-y-3 rounded-xl border p-4">
      <h3 className="font-semibold">Record or import</h3>
      <p className="text-muted-foreground text-xs">
        Import audio or record a microphone take up to 15 minutes. Imported
        takes keep their original speech; transcript timing is not inferred from
        the script.
      </p>
      <div className="flex flex-wrap items-center gap-3">
        <label className="grid gap-1 text-sm">
          Audio file
          <input
            type="file"
            accept="audio/*"
            disabled={busy || recording}
            className="w-full max-w-64 text-xs"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void upload(file);
              event.target.value = "";
            }}
          />
        </label>
        <Button
          variant="outline"
          disabled={busy}
          onClick={() => (recording ? recorder.current?.stop() : void record())}
        >
          {busy
            ? phase
            : recording
              ? "Stop and save recording"
              : "Record microphone"}
        </Button>
      </div>
      {requestingMic && (
        <Button
          variant="outline"
          onClick={() => {
            permissionAttempt.current++;
            setRequestingMic(false);
            setBusy(false);
          }}
        >
          Cancel microphone request
        </Button>
      )}
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={autoTranscribe}
          disabled={busy || recording || !transcription.data?.available}
          onChange={(e) => setAutoTranscribe(e.target.checked)}
        />
        Transcribe locally after import or recording
      </label>
      {recording && (
        <p role="status" className="text-destructive text-sm">
          Recording microphone…
        </p>
      )}
    </section>
  );
}
