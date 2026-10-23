"use client";
import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useLocalTranscriptionStatus } from "@/hooks/script";
import { Button } from "@/components/ui/button";
import { apiPost } from "@/lib/api-client";
import type { PodcastTakeDTO } from "@/lib/dto";
export function RecordingTranscript({
  take,
  podcastId,
}: {
  take: PodcastTakeDTO;
  podcastId: string;
}) {
  const status = useLocalTranscriptionStatus(),
    qc = useQueryClient();
  const [language, setLanguage] = useState("auto"),
    [busy, setBusy] = useState(false),
    [cues, setCues] = useState(
      take.timeline.map((c) => ({
        ...c,
        characterKey: c.characterKey ?? "Speaker",
      })),
    );
  const cancel = useRef<AbortController | null>(null);
  useEffect(() => () => cancel.current?.abort(), []);
  async function run(action: "transcribe" | "save") {
    setBusy(true);
    const controller = new AbortController();
    cancel.current = controller;
    try {
      if (action === "transcribe") {
        const response = await fetch(
          `/api/podcast-takes/${take.id}/transcribe`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action, language }),
            signal: controller.signal,
          },
        );
        if (!response.ok) {
          const result = await response.json();
          throw new Error(result.error ?? "Transcription failed");
        }
      } else
        await apiPost(`/api/podcast-takes/${take.id}/transcribe`, {
          action,
          cues,
        });
      await qc.invalidateQueries({ queryKey: ["podcast", podcastId] });
      toast.success(
        "Transcript saved in a new take; original audio is preserved",
      );
    } catch (e) {
      if (!controller.signal.aborted)
        toast.error(
          e instanceof Error ? e.message : "Could not save transcript",
        );
    } finally {
      setBusy(false);
      cancel.current = null;
    }
  }
  return (
    <details className="mt-3 rounded-lg border p-3">
      <summary className="cursor-pointer text-sm font-medium">
        {take.timeline.length
          ? "Review and edit transcript"
          : "Transcribe this recording locally"}
      </summary>
      <p className="text-muted-foreground my-2 text-xs">
        Whisper runs locally. Review recognized words and speaker labels before
        publishing. A reviewed transcript creates another take sharing these
        audio bytes.
      </p>
      {take.timeline.length ? (
        <fieldset disabled={busy} className="space-y-3">
          <div className="max-h-96 space-y-3 overflow-y-auto">
            {cues.map((cue, i) => (
              <div className="grid gap-2 rounded border p-2" key={cue.turnId}>
                <label className="grid gap-1 text-xs">
                  Speaker
                  <input
                    className="bg-background rounded border p-2"
                    maxLength={80}
                    value={cue.characterKey}
                    onChange={(e) =>
                      setCues((current) =>
                        current.map((c, n) =>
                          n === i ? { ...c, characterKey: e.target.value } : c,
                        ),
                      )
                    }
                  />
                </label>
                <label className="grid gap-1 text-xs">
                  Transcript passage {i + 1}
                  <textarea
                    className="bg-background min-h-20 rounded border p-2"
                    maxLength={4000}
                    value={cue.text}
                    onChange={(e) =>
                      setCues((current) =>
                        current.map((c, n) =>
                          n === i ? { ...c, text: e.target.value } : c,
                        ),
                      )
                    }
                  />
                </label>
                <p className="text-muted-foreground text-xs">
                  {(cue.startFrame / take.fps).toFixed(2)}–
                  {((cue.startFrame + cue.durationFrames) / take.fps).toFixed(
                    2,
                  )}{" "}
                  seconds
                </p>
              </div>
            ))}
          </div>
          <Button
            disabled={
              JSON.stringify(cues) ===
                JSON.stringify(
                  take.timeline.map((c) => ({
                    ...c,
                    characterKey: c.characterKey ?? "Speaker",
                  })),
                ) || cues.some((c) => !c.text.trim() || !c.characterKey.trim())
            }
            onClick={() => void run("save")}
          >
            Save reviewed transcript
          </Button>
        </fieldset>
      ) : (
        <div className="space-y-2">
          <label className="grid gap-1 text-sm">
            Speech language
            <select
              disabled={busy}
              className="bg-background rounded border p-2"
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
            >
              {[
                ["auto", "Detect language"],
                ["en", "English"],
                ["hi", "Hindi"],
                ["es", "Spanish"],
                ["fr", "French"],
                ["de", "German"],
                ["ja", "Japanese"],
                ["zh", "Chinese"],
              ].map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          {!status.data?.available && (
            <p className="text-muted-foreground text-xs">
              {status.data?.reason ??
                "Checking the local transcription runtime…"}
            </p>
          )}
          <Button
            disabled={busy || !status.data?.available}
            onClick={() => void run("transcribe")}
          >
            {busy ? "Transcribing locally…" : "Transcribe locally"}
          </Button>
          {busy && (
            <Button variant="outline" onClick={() => cancel.current?.abort()}>
              Cancel transcription
            </Button>
          )}
        </div>
      )}
    </details>
  );
}
