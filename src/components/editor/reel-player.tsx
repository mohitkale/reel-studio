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

interface ReelPlayerProps {
  scenes: ReelScene[];
  timeline: ReelBeat[];
  totalFrames: number;
  fps: number;
  audioUrl?: string;
  autoPlay?: boolean;
  loop?: boolean;
  tokens?: BrandTokens;
  coverUrl?: string;
}

/** Live Remotion preview of the reel, driven by the scene templates + timeline. */
export const ReelPlayer = React.forwardRef<PlayerRef, ReelPlayerProps>(
  function ReelPlayer(
    { scenes, timeline, totalFrames, fps, audioUrl, autoPlay, loop = true, tokens, coverUrl },
    ref,
  ) {
    const resolvedTokens = tokens ?? defaultBrandTokens;
    const inputProps = React.useMemo(
      () => ({ scenes, timeline, audioUrl, tokens: resolvedTokens, coverUrl }),
      [scenes, timeline, audioUrl, resolvedTokens, coverUrl],
    );

    if (scenes.length === 0) {
      return (
        <div className="mx-auto flex aspect-[9/16] w-full max-w-[280px] items-center justify-center rounded-2xl border border-dashed text-center text-sm text-muted-foreground">
          Add a scene to preview
        </div>
      );
    }

    return (
      <div className="mx-auto w-full max-w-[280px] overflow-hidden rounded-2xl border shadow-sm">
        <Player
          ref={ref}
          component={ReelComposition}
          inputProps={inputProps}
          durationInFrames={Math.max(1, totalFrames)}
          compositionWidth={REEL_WIDTH}
          compositionHeight={REEL_HEIGHT}
          fps={fps}
          style={{ width: "100%", aspectRatio: "9 / 16" }}
          controls
          loop={loop}
          autoPlay={autoPlay}
          acknowledgeRemotionLicense
        />
      </div>
    );
  },
);
