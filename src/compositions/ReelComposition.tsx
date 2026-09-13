"use client";

import * as React from "react";
import { AbsoluteFill, Audio, Img, Sequence, useVideoConfig } from "remotion";

import { type ReelProps, coverFrames } from "./types";
import type { BrandTokens } from "./tokens";
import { getTemplateComponent } from "./registry";
import { Stage, StageOptionsProvider } from "./components/stage";
import { SceneTransition } from "./components/scene-transition";
import { VisualStyleProvider } from "./components/visual-style-context";
import {
  DEFAULT_ENERGY_ID,
  DEFAULT_STYLE_ID,
  getStyleChrome,
} from "./visual-style";
import { resolveProductionLayout } from "@/production/layout";
import { getPresetSceneComponent } from "./presets/registry";
import { SubtitleOverlay } from "./components/subtitle-overlay";
import {
  buildAudioMixPlan,
  clipVolumeAtFrame,
  musicVolumeAtFrame,
} from "@/lib/audio-mix";

/**
 * Static cover/thumbnail frame shown at the very start of the reel. The image is
 * fully contained (never cropped) on the brand background, so any aspect ratio is
 * shown in full; a 9:16 image fills the frame edge to edge.
 */
function CoverFrame({ url, tokens }: { url: string; tokens: BrandTokens }) {
  return (
    <AbsoluteFill
      style={{ backgroundColor: tokens.background, overflow: "hidden" }}
    >
      <Img
        src={url}
        style={{ width: "100%", height: "100%", objectFit: "contain" }}
      />
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
  sfxCues,
  tokens,
  coverUrl,
  hideProgressBar,
  previewQuality = "standard",
  styleId = DEFAULT_STYLE_ID,
  energy = DEFAULT_ENERGY_ID,
  layout,
  preset,
  captions,
}: ReelProps) {
  const { fps, width, height, durationInFrames } = useVideoConfig();
  const resolvedLayout = layout ?? resolveProductionLayout({ width, height });
  const sceneById = new Map(scenes.map((s) => [s.id, s]));
  const cover = coverFrames(fps, Boolean(coverUrl));
  const chrome = getStyleChrome(styleId);
  // Explicit script hide wins; otherwise Style may prefer a cleaner chrome.
  const showProgressBar =
    hideProgressBar === true ? false : !chrome.preferHideProgressBar;

  const audioMix = buildAudioMixPlan({
    fps,
    totalFrames: durationInFrames,
    musicVolume,
    narration: audioUrl
      ? timeline.map((beat) => ({
          startFrame: cover + beat.startFrame,
          durationFrames: beat.durationFrames,
        }))
      : [],
  });

  return (
    <VisualStyleProvider styleId={styleId} energy={energy} fps={fps}>
      <StageOptionsProvider
        showProgressBar={showProgressBar}
        quality={previewQuality}
        layout={resolvedLayout}
      >
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

          {musicUrl && audioMix.musicVolume > 0 ? (
            <Audio
              src={musicUrl}
              loop
              volume={(frame) => musicVolumeAtFrame(frame, audioMix)}
            />
          ) : null}

          {/* Everything after the cover is offset by `cover` via this wrapping Sequence. */}
          <Sequence from={cover} name="Reel">
            {timeline.map((beat, i) => {
              const scene = sceneById.get(beat.sceneId);
              if (!scene) return null;
              const Template =
                getPresetSceneComponent(preset?.id) ??
                getTemplateComponent(scene.templateId);
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
                  <SceneTransition tokens={tokens}>
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
                      <Template
                        scene={scene}
                        tokens={tokens}
                        durationInFrames={duration}
                      />
                    )}
                  </SceneTransition>
                </Sequence>
              );
            })}
            {audioUrl ? <Audio src={audioUrl} /> : null}
            {(sfxCues ?? []).map((cue, i) => (
              <Sequence
                key={`sfx-${i}-${cue.startFrame}`}
                from={cue.startFrame}
                name={`SFX ${i + 1}`}
              >
                <Audio
                  src={cue.url}
                  volume={(frame) =>
                    clipVolumeAtFrame(
                      frame,
                      fps * 2,
                      cue.volume,
                      Math.round(fps * 0.08),
                    )
                  }
                />
              </Sequence>
            ))}
            {captions ? (
              <SubtitleOverlay
                captions={captions}
                tokens={tokens}
                layout={resolvedLayout}
              />
            ) : null}
          </Sequence>
        </AbsoluteFill>
      </StageOptionsProvider>
    </VisualStyleProvider>
  );
});
