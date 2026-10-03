"use client";

import * as React from "react";

import {
  HyperFramesPlayer,
  type HyperFramesPlayerHandle,
} from "@/components/editor/hyperframes-player";
import type { ReelBeat, ReelProps, ReelScene } from "@/video/types";
import type { BrandTokens } from "@/video/tokens";
import type { EnergyId, StyleId } from "@/video/visual-style";
import type { VideoEngineId } from "@/engines/types";
import type { ProductionPresetId } from "@/production/presets";

export type EnginePlayerHandle = HyperFramesPlayerHandle;

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
  sfxCues?: Array<{ url: string; startFrame: number; volume: number }>;
  captions?: ReelProps["captions"];
  spokenWords?: ReelProps["spokenWords"];
  autoPlay?: boolean;
  loop?: boolean;
  tokens?: BrandTokens;
  coverUrl?: string;
  hideProgressBar?: boolean;
  previewQuality?: "standard" | "draft";
  styleId?: StyleId;
  energy?: EnergyId;
  preset?: { id: ProductionPresetId; version: string };
  catalogRevision?: string;
}

/** HyperFrames preview with shared editor transport controls. */
export const EnginePlayer = React.forwardRef<
  EnginePlayerHandle,
  EnginePlayerProps
>(function EnginePlayer(props, ref) {
  return <HyperFramesPlayer ref={ref} {...props} />;
});
