"use client";

import * as React from "react";
import { Player, type PlayerRef } from "@remotion/player";

import { ReelComposition } from "@/compositions/ReelComposition";
import {
  REEL_WIDTH,
  REEL_HEIGHT,
  type ReelBeat,
  type ReelScene,
} from "@/compositions/types";
import { defaultBrandTokens, type BrandTokens } from "@/compositions/tokens";
import type { EnergyId, StyleId } from "@/compositions/visual-style";

interface ReelPlayerProps {
  scenes: ReelScene[];
  timeline: ReelBeat[];
  totalFrames: number;
  fps: number;
  /** Composition canvas size (orientation). Defaults to portrait. */
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
  /** "draft" trims expensive preview effects for smoother scrubbing. */
  previewQuality?: "standard" | "draft";
  styleId?: StyleId;
  energy?: EnergyId;
}

/** Live Remotion preview of the reel, driven by the scene templates + timeline.
 * `acknowledgeRemotionLicense` is required by Remotion's Player — Remotion is
 * source-available under the Remotion License (not MIT). See docs/LICENSING.md.
 */
export const ReelPlayer = React.forwardRef<PlayerRef, ReelPlayerProps>(
  function ReelPlayer(
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
      previewQuality = "standard",
      styleId,
      energy,
    },
    ref,
  ) {
    const resolvedTokens = tokens ?? defaultBrandTokens;
    const inputProps = React.useMemo(
      () => ({
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
        previewQuality,
        styleId,
        energy,
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
        previewQuality,
        styleId,
        energy,
      ],
    );

    const aspectRatio = `${width} / ${height}`;
    // Portrait previews stay narrow; landscape/square get more width so they
    // don't render as a tiny sliver.
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

    return (
      <div className={`mx-auto w-full ${frameClass} overflow-hidden rounded-2xl border shadow-sm`}>
        <Player
          ref={ref}
          component={ReelComposition}
          inputProps={inputProps}
          durationInFrames={Math.max(1, totalFrames)}
          compositionWidth={width}
          compositionHeight={height}
          fps={fps}
          style={{ width: "100%", aspectRatio }}
          controls
          loop={loop}
          autoPlay={autoPlay}
          acknowledgeRemotionLicense
        />
      </div>
    );
  },
);
