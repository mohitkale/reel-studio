import type { CaptionTrackDTO } from "@/lib/dto";

export interface SpokenWordWindow {
  startFrame: number;
  endFrame: number;
}

/** Caption visibility does not affect narration. Only measured words from the
 * audible take, at the current frame rate, can protect its speech. Old tracks,
 * imported/estimated cues and tracks from other takes never guess word timing.
 * Times are narration-relative; the cover offset is applied by both renderers.
 */
export function resolveSpokenWordWindows(
  tracks: readonly CaptionTrackDTO[] | undefined,
  audibleTakeId: string | null | undefined,
  fps: number,
): SpokenWordWindow[] {
  if (!audibleTakeId) return [];
  const track = tracks?.find(
    (candidate) =>
      candidate.sourceTakeId === audibleTakeId &&
      candidate.sourceFps === fps &&
      (candidate.timingSource === "provider" ||
        candidate.timingSource === "local-transcription"),
  );
  if (!track) return [];
  return track.cues.flatMap((cue) =>
    (cue.words ?? [])
      .filter(
        (word) =>
          word.text.trim() &&
          Number.isInteger(word.startFrame) &&
          Number.isInteger(word.endFrame) &&
          word.startFrame >= cue.startFrame &&
          word.endFrame <= cue.endFrame &&
          word.endFrame > word.startFrame,
      )
      .map(({ startFrame, endFrame }) => ({ startFrame, endFrame })),
  );
}
