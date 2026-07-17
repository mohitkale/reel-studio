"use client";

import * as React from "react";
import type { PlayerRef } from "@remotion/player";

import { ReelPlayer } from "@/components/editor/reel-player";
import {
  HyperFramesPlayer,
  type HyperFramesPlayerHandle,
} from "@/components/editor/hyperframes-player";
import type { ReelBeat, ReelScene } from "@/compositions/types";
import type { BrandTokens } from "@/compositions/tokens";
import type { VideoEngineId } from "@/engines/types";

export type EnginePlayerHandle = PlayerRef | HyperFramesPlayerHandle;

interface EnginePlayerProps {
  videoEngine: VideoEngineId;
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

/** Engine-selected preview player (Remotion or HyperFrames). */
export const EnginePlayer = React.forwardRef<
  EnginePlayerHandle,
  EnginePlayerProps
>(function EnginePlayer({ videoEngine, ...props }, ref) {
  if (videoEngine === "hyperframes") {
    return (
      <HyperFramesPlayer
        ref={ref as React.Ref<HyperFramesPlayerHandle>}
        {...props}
      />
    );
  }
  return <ReelPlayer ref={ref as React.Ref<PlayerRef>} {...props} />;
});
