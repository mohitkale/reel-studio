"use client";

import { AbsoluteFill, Audio, Sequence } from "remotion";

import type { ReelProps } from "./types";
import { getTemplateComponent } from "./registry";

/**
 * Root composition: lays each scene out as an absolute Sequence at its measured
 * startFrame/durationFrames (so visuals stay locked to the voice take), renders
 * the scene's template, and mixes the chosen audio track on top.
 */
export function ReelComposition({
  scenes,
  timeline,
  audioUrl,
  tokens,
}: ReelProps) {
  const sceneById = new Map(scenes.map((s) => [s.id, s]));

  return (
    <AbsoluteFill
      style={{
        backgroundColor: tokens.background,
        fontFamily: tokens.fontFamily,
      }}
    >
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
            <Template scene={scene} tokens={tokens} durationInFrames={duration} />
          </Sequence>
        );
      })}
      {audioUrl ? <Audio src={audioUrl} /> : null}
    </AbsoluteFill>
  );
}
