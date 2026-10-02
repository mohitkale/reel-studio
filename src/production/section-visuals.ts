import { coverFrames, type ReelProps } from "@/video/types";
import type { RenderSection } from "@/production/render-sections";

/** Scope the actual silent render, retaining the global timeline and scene order.
 * ReelComposition holds a beat through the next start; include that gap too.
 * Audio is assembled from the original complete graph separately.
 */
export function sectionVisualProps(
  props: ReelProps,
  section: RenderSection,
  fps: number,
): ReelProps {
  const cover = coverFrames(fps, Boolean(props.coverUrl));
  const activeIds = new Set(
    props.timeline
      .filter((beat, index) => {
        const end =
          props.timeline[index + 1]?.startFrame ??
          beat.startFrame + beat.durationFrames;
        return (
          cover + beat.startFrame <= section.endFrame &&
          cover + end > section.startFrame
        );
      })
      .map((beat) => beat.sceneId),
  );
  return {
    ...props,
    scenes: props.scenes.filter((scene) => activeIds.has(scene.id)),
    audioUrl: undefined,
    musicUrl: undefined,
    musicVolume: undefined,
    sfxCues: [],
    captions: props.captions
      ? {
          ...props.captions,
          cues: props.captions.cues.filter(
            (cue) =>
              cover + cue.startFrame <= section.endFrame &&
              cover + cue.endFrame > section.startFrame,
          ),
        }
      : undefined,
  };
}
