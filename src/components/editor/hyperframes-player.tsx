"use client";

import * as React from "react";
import { Maximize2, Minimize2, Pause, Play } from "lucide-react";

import {
  REEL_WIDTH,
  REEL_HEIGHT,
  type ReelBeat,
  type ReelScene,
} from "@/compositions/types";
import { defaultBrandTokens, type BrandTokens } from "@/compositions/tokens";
import { buildHyperframesCompositionHtml } from "@/engines/hyperframes/build-composition";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

export interface HyperFramesPlayerHandle {
  seekTo(frame: number): void;
  play(): void;
  pause(): void;
  getCurrentFrame(): number;
}

interface HyperFramesPlayerProps {
  scenes: ReelScene[];
  timeline: ReelBeat[];
  totalFrames: number;
  fps: number;
  width?: number;
  height?: number;
  audioUrl?: string;
  musicUrl?: string;
  musicVolume?: number;
  autoPlay?: boolean;
  loop?: boolean;
  tokens?: BrandTokens;
  coverUrl?: string;
  hideProgressBar?: boolean;
  previewQuality?: "standard" | "draft";
}

function formatClock(seconds: number): string {
  const s = Math.max(0, seconds);
  const m = Math.floor(s / 60);
  const rem = Math.floor(s % 60);
  return `${m}:${rem.toString().padStart(2, "0")}`;
}

type IframeApi = Window & {
  __reelSeek?: (t: number) => void;
  __reelPlay?: () => void;
  __reelPause?: () => void;
  __reelDuration?: number;
};

/**
 * In-editor HyperFrames preview with Remotion-like transport controls.
 * The composition HTML letterboxes itself inside the iframe so portrait
 * canvases stay fully visible and centered in both inline and fullscreen modes.
 */
export const HyperFramesPlayer = React.forwardRef<
  HyperFramesPlayerHandle,
  HyperFramesPlayerProps
>(function HyperFramesPlayer(
  {
    scenes,
    timeline,
    totalFrames,
    fps,
    width = REEL_WIDTH,
    height = REEL_HEIGHT,
    audioUrl,
    musicUrl,
    musicVolume,
    autoPlay,
    loop = true,
    tokens,
    coverUrl,
    hideProgressBar,
  },
  ref,
) {
  const iframeRef = React.useRef<HTMLIFrameElement>(null);
  const shellRef = React.useRef<HTMLDivElement>(null);
  const frameRef = React.useRef(0);
  const timeRef = React.useRef(0);
  const playingRef = React.useRef(false);
  const [playing, setPlaying] = React.useState(false);
  const [currentTime, setCurrentTime] = React.useState(0);
  const [fullscreen, setFullscreen] = React.useState(false);
  const [ready, setReady] = React.useState(false);
  const resolvedTokens = tokens ?? defaultBrandTokens;

  const durationSec = Math.max(1 / Math.max(1, fps), totalFrames / Math.max(1, fps));

  const html = React.useMemo(
    () =>
      buildHyperframesCompositionHtml({
        scenes,
        timeline,
        audioUrl,
        musicUrl,
        musicVolume,
        tokens: resolvedTokens,
        coverUrl,
        width,
        height,
        fps,
        hideProgressBar,
      }),
    [
      scenes,
      timeline,
      audioUrl,
      musicUrl,
      musicVolume,
      resolvedTokens,
      coverUrl,
      width,
      height,
      fps,
      hideProgressBar,
    ],
  );

  const seekIframe = React.useCallback((seconds: number) => {
    const win = iframeRef.current?.contentWindow as IframeApi | null;
    win?.__reelSeek?.(seconds);
  }, []);

  const seekToTime = React.useCallback(
    (seconds: number) => {
      const next = Math.max(0, Math.min(durationSec, seconds));
      timeRef.current = next;
      frameRef.current = Math.round(next * fps);
      setCurrentTime(next);
      seekIframe(next);
    },
    [durationSec, fps, seekIframe],
  );

  const play = React.useCallback(() => {
    playingRef.current = true;
    setPlaying(true);
  }, []);

  const pause = React.useCallback(() => {
    playingRef.current = false;
    setPlaying(false);
    const win = iframeRef.current?.contentWindow as IframeApi | null;
    win?.__reelPause?.();
  }, []);

  const togglePlay = React.useCallback(() => {
    if (playingRef.current) pause();
    else {
      if (timeRef.current >= durationSec - 0.05) seekToTime(0);
      play();
    }
  }, [durationSec, pause, play, seekToTime]);

  React.useImperativeHandle(
    ref,
    () => ({
      seekTo(frame: number) {
        seekToTime(frame / Math.max(1, fps));
      },
      play,
      pause,
      getCurrentFrame() {
        return frameRef.current;
      },
    }),
    [fps, pause, play, seekToTime],
  );

  React.useEffect(() => {
    if (!playing) return;
    let raf = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = (now - last) / 1000;
      last = now;
      let next = timeRef.current + dt;
      if (next >= durationSec) {
        if (loop) {
          next = 0;
        } else {
          seekToTime(durationSec);
          pause();
          return;
        }
      }
      timeRef.current = next;
      frameRef.current = Math.round(next * fps);
      setCurrentTime(next);
      seekIframe(next);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing, durationSec, fps, loop, pause, seekIframe, seekToTime]);

  React.useEffect(() => {
    setReady(false);
    pause();
    seekToTime(0);
  }, [html]); // eslint-disable-line react-hooks/exhaustive-deps -- reset when composition rebuilds

  React.useEffect(() => {
    if (!autoPlay || !ready) return;
    const id = window.setTimeout(() => play(), 80);
    return () => window.clearTimeout(id);
  }, [autoPlay, ready, play, html]);

  React.useEffect(() => {
    function onFsChange() {
      setFullscreen(Boolean(document.fullscreenElement));
    }
    document.addEventListener("fullscreenchange", onFsChange);
    return () => document.removeEventListener("fullscreenchange", onFsChange);
  }, []);

  async function toggleFullscreen() {
    const el = shellRef.current;
    if (!el) return;
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      } else {
        await el.requestFullscreen();
      }
    } catch {
      /* browser blocked fullscreen — ignore */
    }
  }

  const aspectRatio = `${width} / ${height}`;
  const frameClass = height > width ? "max-w-[280px]" : "max-w-[520px]";

  if (scenes.length === 0) {
    return (
      <div
        className={`mx-auto flex w-full ${frameClass} items-center justify-center rounded-2xl border border-dashed text-center text-sm text-muted-foreground`}
        style={{ aspectRatio }}
      >
        Add a scene to preview
      </div>
    );
  }

  const progressPct = Math.min(100, (currentTime / durationSec) * 100);

  return (
    <div
      ref={shellRef}
      className={cn(
        "flex flex-col overflow-hidden bg-black shadow-sm",
        fullscreen
          ? "h-screen w-screen max-w-none rounded-none"
          : cn("mx-auto w-full rounded-2xl border", frameClass),
      )}
    >
      <div
        className={cn(
          "relative flex min-h-0 flex-1 items-center justify-center bg-black",
          !fullscreen && "w-full",
        )}
        style={fullscreen ? undefined : { aspectRatio }}
      >
        <iframe
          ref={iframeRef}
          title="HyperFrames preview"
          srcDoc={html}
          sandbox="allow-scripts allow-same-origin"
          className="h-full w-full border-0 bg-black"
          onLoad={() => {
            setReady(true);
            seekIframe(timeRef.current);
          }}
        />
      </div>

      <div className="flex shrink-0 items-center gap-2 border-t border-white/10 bg-zinc-950 px-2 py-1.5 text-zinc-100">
        <Button
          type="button"
          size="icon"
          variant="ghost"
          className="size-8 shrink-0 text-zinc-100 hover:bg-white/10 hover:text-white"
          aria-label={playing ? "Pause" : "Play"}
          onClick={togglePlay}
        >
          {playing ? <Pause className="size-4" /> : <Play className="size-4" />}
        </Button>

        <input
          type="range"
          min={0}
          max={durationSec}
          step={1 / Math.max(1, fps)}
          value={currentTime}
          aria-label="Seek"
          className="h-1.5 flex-1 cursor-pointer appearance-none rounded-full bg-zinc-700 accent-primary"
          style={{
            background: `linear-gradient(to right, var(--primary) ${progressPct}%, rgb(63 63 70) ${progressPct}%)`,
          }}
          onChange={(e) => {
            const next = Number(e.target.value);
            if (playingRef.current) pause();
            seekToTime(next);
          }}
        />

        <span className="shrink-0 tabular-nums text-[11px] text-zinc-400">
          {formatClock(currentTime)} / {formatClock(durationSec)}
        </span>

        <Button
          type="button"
          size="icon"
          variant="ghost"
          className="size-8 shrink-0 text-zinc-100 hover:bg-white/10 hover:text-white"
          aria-label={fullscreen ? "Exit fullscreen" : "Fullscreen"}
          onClick={() => void toggleFullscreen()}
        >
          {fullscreen ? (
            <Minimize2 className="size-4" />
          ) : (
            <Maximize2 className="size-4" />
          )}
        </Button>
      </div>
    </div>
  );
});
