"use client";

import * as React from "react";
import { AbsoluteFill, Audio, Img, Sequence, useVideoConfig } from "remotion";

import { type ReelProps, coverFrames } from "./types";
import type { BrandTokens } from "./tokens";
import { getTemplateComponent } from "./registry";
import { Stage, StageOptionsProvider } from "./components/stage";

/**
 * Static cover/thumbnail frame shown at the very start of the reel. The image is
 * fully contained (never cropped) on the brand background, so any aspect ratio is
 * shown in full; a 9:16 image fills the frame edge to edge.
 */
function CoverFrame({ url, tokens }: { url: string; tokens: BrandTokens }) {
  return (
    <AbsoluteFill style={{ backgroundColor: tokens.background, overflow: "hidden" }}>
      <Img src={url} style={{ width: "100%", height: "100%", objectFit: "contain" }} />
    </AbsoluteFill>
  );
}

/**
 * Root composition: lays each scene out as an absolute Sequence at its measured
 * startFrame/durationFrames (so visuals stay locked to the voice take), renders
 * the scene's template, and mixes the chosen audio track on top.
 *
 * When a cover image is set it is held for `coverFrames` at the start (acting as
 * a baked-in thumbnail), and the scenes + audio are shifted by that amount so
 * their sync is preserved. The composition's durationInFrames (set by the caller)
 * must already include the cover hold.
 */
export const ReelComposition = React.memo(function ReelComposition({
  scenes,
  timeline,
  audioUrl,
  musicUrl,
  musicVolume = 20,
  tokens,
  coverUrl,
  hideProgressBar,
  previewQuality = "standard",
}: ReelProps) {
  const { fps } = useVideoConfig();
  const sceneById = new Map(scenes.map((s) => [s.id, s]));
  const cover = coverFrames(fps, Boolean(coverUrl));

  // Background music level (0-1). When there's a voiceover, duck the music while
  // a scene is being spoken so narration stays clear; lift it in the gaps.
  const baseMusic = Math.max(0, Math.min(1, musicVolume / 100));
  const isVoiced = (frame: number) =>
    timeline.some(
      (b) => frame >= b.startFrame && frame < b.startFrame + b.durationFrames,
    );
  const musicAt = (frame: number) =>
    audioUrl && isVoiced(frame) ? baseMusic * 0.35 : baseMusic;

  return (
    <StageOptionsProvider showProgressBar={!hideProgressBar} quality={previewQuality}>
    <AbsoluteFill
      style={{
        backgroundColor: tokens.background,
        fontFamily: tokens.fontFamily,
      }}
    >
      {coverUrl ? (
        <Sequence durationInFrames={cover} name="Cover">
          <CoverFrame url={coverUrl} tokens={tokens} />
        </Sequence>
      ) : null}

      {/* Everything after the cover is offset by `cover` via this wrapping Sequence. */}
      <Sequence from={cover} name="Reel">
        {timeline.map((beat, i) => {
          const scene = sceneById.get(beat.sceneId);
          if (!scene) return null;
          const Template = getTemplateComponent(scene.templateId);
          // Hold each scene until the next one starts so the inter-beat audio gap
          // never shows a black frame. The last scene uses its own duration.
          const next = timeline[i + 1];
          const end = next
            ? next.startFrame
            : beat.startFrame + beat.durationFrames;
          const duration = Math.max(1, end - beat.startFrame);
          return (
            <Sequence
              key={beat.sceneId}
              from={beat.startFrame}
              durationInFrames={duration}
              name={scene.text.slice(0, 24) || "Scene"}
            >
              {scene.hideText ? (
                // Text hidden: show just the (image/video) background + brand chrome.
                <Stage
                  tokens={tokens}
                  background={scene.background}
                  mood={scene.mood}
                  treatmentSeed={scene.order}
                  durationInFrames={duration}
                />
              ) : (
                <Template scene={scene} tokens={tokens} durationInFrames={duration} />
              )}
            </Sequence>
          );
        })}
        {audioUrl ? <Audio src={audioUrl} /> : null}
        {musicUrl && baseMusic > 0 ? (
          <Audio src={musicUrl} loop volume={musicAt} />
        ) : null}
      </Sequence>
    </AbsoluteFill>
    </StageOptionsProvider>
  );
});
