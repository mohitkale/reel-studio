"use client";

import * as React from "react";

import type { PodcastGenerationProgress } from "@/hooks/podcasts";

function formatEta(ms: number): string {
  if (!Number.isFinite(ms) || ms < 0) return "—";
  const sec = Math.max(0, Math.ceil(ms / 1000));
  if (sec < 60) return `~${sec}s`;
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return s > 0 ? `~${m}m ${s}s` : `~${m}m`;
}

function formatSpeed(msPerChunk: number): string {
  if (!Number.isFinite(msPerChunk) || msPerChunk <= 0) return "—";
  const sec = msPerChunk / 1000;
  if (sec < 10) return `${sec.toFixed(1)}s / turn`;
  return `${Math.round(sec)}s / turn`;
}

type Display = {
  percent: number;
  label: string;
  done: number;
  total: number;
  avgMs: number;
  etaMs: number | undefined;
  stitching: boolean;
};

/**
 * Chunk progress with intra-chunk animation (bar creeps while a turn synths),
 * average speed from completed chunks, and an ETA that counts down.
 *
 * Timing bookkeeping runs inside the interval callback (not render effects)
 * so the bar keeps moving between SSE chunk updates.
 */
export function PodcastGenerateProgress({
  progress,
  startedAt,
}: {
  progress: PodcastGenerationProgress;
  startedAt: number;
}) {
  const progressRef = React.useRef(progress);
  const book = React.useRef({
    chunkStartedAt: startedAt,
    trackedDone: 0,
    trackedWorking: null as number | null,
    durations: [] as number[],
  });

  const [display, setDisplay] = React.useState<Display>(() => ({
    percent: 0,
    label: "Starting…",
    done: 0,
    total: Math.max(progress.sceneCount, 1),
    avgMs: 0,
    etaMs: undefined,
    stitching: false,
  }));

  React.useEffect(() => {
    progressRef.current = progress;
  }, [progress]);

  React.useEffect(() => {
    book.current = {
      chunkStartedAt: startedAt,
      trackedDone: 0,
      trackedWorking: null,
      durations: [],
    };
  }, [startedAt]);

  React.useEffect(() => {
    const tick = () => {
      const p = progressRef.current;
      const now = Date.now();
      const total = Math.max(p.sceneCount, 1);
      const done = Math.min(Math.max(p.scene, 0), total);
      const stitching = p.status === "stitching";
      const queued = p.status === "queued";
      const working =
        p.workingOn ??
        (p.status === "synthesizing" && total > 0
          ? Math.min(done + 1, total)
          : null);

      const b = book.current;
      if (done > b.trackedDone) {
        const dur = now - b.chunkStartedAt;
        if (dur > 50) b.durations.push(dur);
        b.chunkStartedAt = now;
        b.trackedDone = done;
      }
      if (
        working != null &&
        (b.trackedWorking == null || working > b.trackedWorking)
      ) {
        b.chunkStartedAt = now;
        b.trackedWorking = working;
      }

      const avgMs =
        b.durations.length > 0
          ? b.durations.reduce((a, c) => a + c, 0) / b.durations.length
          : 0;
      const timeOnCurrent = Math.max(0, now - b.chunkStartedAt);
      const expectedChunkMs = avgMs > 0 ? avgMs : 6000;

      const turnCap = 92;
      const slot = turnCap / total;
      const base = (done / total) * turnCap;
      const withinRatio = Math.min(
        0.9,
        1 - Math.exp(-timeOnCurrent / Math.max(expectedChunkMs * 0.65, 800)),
      );
      const within = p.status === "synthesizing" ? withinRatio * slot : 0;

      const percent = queued
        ? Math.min(4, withinRatio * 4)
        : stitching
          ? Math.min(99, 93 + withinRatio * 6)
          : Math.min(turnCap, Math.round((base + within) * 10) / 10);

      const remainingAfterCurrent = Math.max(
        0,
        total - done - (working != null && done < total ? 1 : 0),
      );
      const currentLeft = Math.max(0, expectedChunkMs - timeOnCurrent);
      const etaMs = stitching
        ? Math.max(400, 2500 - timeOnCurrent)
        : avgMs > 0 || done > 0
          ? remainingAfterCurrent * expectedChunkMs + currentLeft + 1500
          : undefined;

      const label = queued
        ? "Starting…"
        : stitching
          ? "Stitching turns in order…"
          : working
            ? `Synthesizing turn ${working} of ${total}`
            : "Synthesizing…";

      setDisplay({
        percent,
        label,
        done,
        total,
        avgMs,
        etaMs,
        stitching,
      });
    };

    tick();
    const id = window.setInterval(tick, 200);
    return () => window.clearInterval(id);
  }, [startedAt]);

  return (
    <div className="grid w-full gap-2 rounded-lg border bg-muted/30 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
        <span className="font-medium">{display.label}</span>
        <span className="tabular-nums text-muted-foreground">
          {Math.floor(display.percent)}%
        </span>
      </div>
      <div
        className="h-2.5 w-full overflow-hidden rounded-full bg-muted"
        role="progressbar"
        aria-valuenow={Math.floor(display.percent)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Podcast audio generation progress"
      >
        <div
          className="h-full rounded-full bg-primary transition-[width] duration-200 ease-linear"
          style={{ width: `${display.percent}%` }}
        />
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <span>
          Chunks{" "}
          <span className="tabular-nums text-foreground">
            {display.stitching ? display.total : display.done}/{display.total}
          </span>
        </span>
        <span>
          Speed{" "}
          <span className="tabular-nums text-foreground">
            {display.avgMs > 0 ? formatSpeed(display.avgMs) : "calibrating…"}
          </span>
        </span>
        <span>
          ETA{" "}
          <span className="tabular-nums text-foreground">
            {display.etaMs != null ? formatEta(display.etaMs) : "—"}
          </span>
        </span>
      </div>
    </div>
  );
}
