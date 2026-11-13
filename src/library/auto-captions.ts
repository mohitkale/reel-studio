/**
 * Automatic caption track for a finished voice take. Captions show the
 * narration, split into short phrases: measured word timing when the take has
 * it and it matches the spoken text, otherwise an honest proportional estimate.
 * Pure and deterministic, so a retried job produces the same track.
 */
import { speechWordsMatchText } from "@/lib/speech-words";
import {
  captionStyleForProductionPreset,
  type CaptionStyleSnapshot,
} from "@/lib/caption-style";
import type { VideoSnapshot } from "@/production/video-snapshot";

type CaptionTrack = NonNullable<
  VideoSnapshot["script"]["captionTracks"]
>[number];
type Take = NonNullable<VideoSnapshot["take"]>;

const MAX_WORDS_PER_CUE = 7;

function chunkWords(words: string[]): string[][] {
  const chunks: string[][] = [];
  let current: string[] = [];
  for (const word of words) {
    current.push(word);
    const sentenceEnd = /[.!?]["')\]]*$/.test(word);
    if (
      current.length >= MAX_WORDS_PER_CUE ||
      (sentenceEnd && current.length >= 3)
    ) {
      chunks.push(current);
      current = [];
    }
  }
  if (current.length > 0) {
    if (chunks.length > 0 && current.length < 3)
      chunks[chunks.length - 1]!.push(...current);
    else chunks.push(current);
  }
  return chunks;
}

export function buildAutoCaptionTrack(input: {
  scriptId: string;
  take: Take;
  presetId?: Parameters<typeof captionStyleForProductionPreset>[0];
  style?: CaptionStyleSnapshot;
}): CaptionTrack | null {
  const { take } = input;
  const cues: CaptionTrack["cues"] = [];
  let measured = 0;
  let total = 0;

  for (const beat of take.timeline) {
    const text = beat.text.replace(/\s+/g, " ").trim();
    if (!text) continue;
    total += 1;
    const words = text.split(" ");
    const timed =
      beat.words &&
      beat.words.length > 0 &&
      speechWordsMatchText(text, beat.words)
        ? beat.words
        : null;
    const beatEnd = beat.startFrame + beat.durationFrames;
    let cursor = 0;
    for (const chunk of chunkWords(words)) {
      let startFrame: number;
      let endFrame: number;
      if (timed && timed.length === words.length) {
        startFrame = timed[cursor]!.startFrame;
        endFrame = timed[cursor + chunk.length - 1]!.endFrame;
      } else {
        const before = words.slice(0, cursor).join(" ").length;
        const through = words.slice(0, cursor + chunk.length).join(" ").length;
        startFrame =
          beat.startFrame +
          Math.round((before / text.length) * beat.durationFrames);
        endFrame =
          beat.startFrame +
          Math.round((through / text.length) * beat.durationFrames);
      }
      startFrame = Math.max(beat.startFrame, startFrame);
      endFrame = Math.min(beatEnd, Math.max(endFrame, startFrame + 1));
      if (endFrame <= startFrame) endFrame = startFrame + 1;
      const index = cues.length;
      cues.push({
        id: `auto-${index}`,
        order: index,
        startFrame,
        endFrame,
        text: chunk.join(" "),
        ...(timed && timed.length === words.length
          ? {
              words: chunk.map((_, i) => ({
                text: timed[cursor + i]!.text,
                startFrame: timed[cursor + i]!.startFrame,
                endFrame: timed[cursor + i]!.endFrame,
              })),
            }
          : {}),
      });
      cursor += chunk.length;
    }
    if (timed && timed.length === words.length) measured += 1;
  }
  if (cues.length === 0) return null;

  return {
    id: "auto-captions",
    scriptId: input.scriptId,
    label: "Auto captions",
    language: "en",
    timingSource: total > 0 && measured === total ? "provider" : "estimated",
    sourceTakeId: take.id,
    sourceFps: take.fps,
    enabled: true,
    style: input.style ?? captionStyleForProductionPreset(input.presetId),
    updatedAt: take.createdAt,
    cues,
  };
}
