"use client";

import * as React from "react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

interface ModelState {
  cached: boolean;
  location: string;
  approxBytes: number;
  job:
    | { state: "idle" }
    | {
        state: "downloading";
        progress?: { bytesDone: number; bytesTotal: number; file: string };
      }
    | { state: "done" }
    | { state: "error"; message: string };
}

/**
 * The one confirmation before the voice model downloads: its size, where it
 * goes, a progress bar, and a way to say no (a silent video with captions).
 */
export function VoiceModelCard() {
  const [state, setState] = React.useState<ModelState>();
  const [error, setError] = React.useState<string>();

  const [tick, setTick] = React.useState(0);

  React.useEffect(() => {
    let alive = true;
    fetch("/api/voice-model")
      .then((response) => response.json() as Promise<ModelState>)
      .then((next) => {
        if (alive) setState(next);
      })
      .catch((e: unknown) => {
        if (alive)
          setError(
            e instanceof Error ? e.message : "Could not reach the studio",
          );
      });
    return () => {
      alive = false;
    };
  }, [tick]);
  React.useEffect(() => {
    if (state?.job.state !== "downloading") return;
    const timer = setInterval(() => setTick((n) => n + 1), 1000);
    return () => clearInterval(timer);
  }, [state?.job.state]);

  async function start() {
    setError(undefined);
    await fetch("/api/voice-model", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ confirm: true }),
    });
    setTick((n) => n + 1);
  }

  if (!state) return null;
  if (state.cached) return null;
  const progress =
    state.job.state === "downloading" ? state.job.progress : undefined;
  const percent = progress
    ? Math.round((progress.bytesDone / Math.max(1, progress.bytesTotal)) * 100)
    : 0;
  return (
    <Card className="space-y-3 p-4" data-testid="voice-model-card">
      <h2 className="text-sm font-semibold">Add a voice to your videos</h2>
      <p className="text-muted-foreground text-sm">
        Narration runs on this computer. It needs a one-time download of about{" "}
        {Math.round(state.approxBytes / 1_000_000)} MB, saved to{" "}
        <code className="text-xs">{state.location}</code>. After that it works
        offline. Without it, videos are silent with captions, and you can add
        the voice later.
      </p>
      {state.job.state === "downloading" ? (
        <div
          role="progressbar"
          aria-valuenow={percent}
          aria-valuemin={0}
          aria-valuemax={100}
          className="bg-muted h-2 w-full overflow-hidden rounded"
        >
          <div className="bg-primary h-full" style={{ width: `${percent}%` }} />
        </div>
      ) : (
        <Button size="sm" onClick={() => void start()}>
          Download the voice model
        </Button>
      )}
      {state.job.state === "error" || error ? (
        <p className="text-destructive text-xs">
          {state.job.state === "error" ? state.job.message : error} Try again to
          resume.
        </p>
      ) : null}
    </Card>
  );
}
