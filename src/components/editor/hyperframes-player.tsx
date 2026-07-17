"use client";

import * as React from "react";

import {
  REEL_WIDTH,
  REEL_HEIGHT,
  type ReelBeat,
  type ReelScene,
} from "@/compositions/types";
import { defaultBrandTokens, type BrandTokens } from "@/compositions/tokens";
import { buildHyperframesCompositionHtml } from "@/engines/hyperframes/build-composition";

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

/**
 * In-editor HyperFrames preview: renders the generated HTML composition in an
 * iframe and bridges seek/play to match Remotion PlayerRef usage.
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
  const frameRef = React.useRef(0);
  const resolvedTokens = tokens ?? defaultBrandTokens;

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

  const srcDoc = html;

  const call = React.useCallback((fn: string, ...args: unknown[]) => {
    const win = iframeRef.current?.contentWindow as
      | (Window & {
          __reelSeek?: (t: number) => void;
          __reelPlay?: () => void;
          __reelPause?: () => void;
          __reelDuration?: number;
        })
      | null;
    if (!win) return;
    if (fn === "seek" && typeof win.__reelSeek === "function") {
      win.__reelSeek(args[0] as number);
    } else if (fn === "play" && typeof win.__reelPlay === "function") {
      win.__reelPlay();
    } else if (fn === "pause" && typeof win.__reelPause === "function") {
      win.__reelPause();
    }
  }, []);

  React.useImperativeHandle(
    ref,
    () => ({
      seekTo(frame: number) {
        frameRef.current = frame;
        call("seek", frame / Math.max(1, fps));
      },
      play() {
        call("play");
      },
      pause() {
        call("pause");
      },
      getCurrentFrame() {
        return frameRef.current;
      },
    }),
    [call, fps],
  );

  React.useEffect(() => {
    if (!autoPlay) return;
    const id = window.setTimeout(() => call("play"), 80);
    return () => window.clearTimeout(id);
  }, [autoPlay, call, srcDoc]);

  // Soft loop: when composition ends under autoplay/loop, restart.
  React.useEffect(() => {
    if (!loop) return;
    const durationSec = totalFrames / Math.max(1, fps);
    if (!Number.isFinite(durationSec) || durationSec <= 0) return;
    let cancelled = false;
    let timer: number | undefined;
    const arm = () => {
      timer = window.setTimeout(() => {
        if (cancelled) return;
        call("seek", 0);
        call("play");
        arm();
      }, durationSec * 1000);
    };
    if (autoPlay || loop) arm();
    return () => {
      cancelled = true;
      if (timer) window.clearTimeout(timer);
    };
  }, [loop, autoPlay, totalFrames, fps, call, srcDoc]);

  const aspect = height / Math.max(1, width);

  return (
    <div
      className="relative w-full overflow-hidden rounded-lg bg-black"
      style={{ aspectRatio: `${width} / ${height}`, maxHeight: "70vh" }}
    >
      <iframe
        ref={iframeRef}
        title="HyperFrames preview"
        srcDoc={srcDoc}
        sandbox="allow-scripts allow-same-origin"
        className="absolute inset-0 h-full w-full border-0"
        style={{ aspectRatio: String(1 / aspect) }}
      />
    </div>
  );
});
