/**
 * Word timing from a speech recogniser's word list (roadmap V4b).
 *
 * The recogniser (whisper.cpp) hears the take and reports each word with a
 * start time. This matches those words to the words of each scene's narration
 * and returns frame timing for every one of them, or nothing for a scene whose
 * words could not be matched well enough. Pure and deterministic.
 */
import type { SpeechSpan } from "@/lib/speech-spans";

export interface HeardWord {
  text: string;
  /** Start of the word in milliseconds from the start of the take. */
  ms: number;
}

export interface TimedWord {
  text: string;
  startFrame: number;
  endFrame: number;
}

const norm = (word: string) =>
  word.toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");

/**
 * Whisper.cpp `-ojf` output to words: a token with a leading space starts one.
 * With `-dtw` each token also carries `t_dtw` (centiseconds), which tracks the
 * audio far better than the plain offsets (two models agree within 80 ms for
 * most words, against about 200 ms for the offsets), so it is used when present.
 */
export function heardWordsFromWhisperJson(json: unknown): HeardWord[] {
  const raw = (
    json as {
      transcription?: Array<{
        tokens?: Array<{
          text?: string;
          offsets?: { from?: number };
          t_dtw?: number;
        }>;
      }>;
    }
  )?.transcription;
  const segments = Array.isArray(raw) ? raw : [];
  const words: HeardWord[] = [];
  for (const segment of segments)
    for (const token of Array.isArray(segment?.tokens) ? segment.tokens : []) {
      const text = token.text ?? "";
      const from =
        typeof token.t_dtw === "number" && token.t_dtw >= 0
          ? token.t_dtw * 10
          : token.offsets?.from;
      if (typeof from !== "number" || /^\[_.*\]$/.test(text)) continue;
      if (/^\s/.test(text) || !words.length) {
        if (text.trim()) words.push({ text: text.trim(), ms: from });
      } else words[words.length - 1]!.text += text;
    }
  return words.filter((word) => norm(word.text));
}

/**
 * A word that starts in a pause is really the first word after it: move it to
 * the start of the next stretch of speech.
 */
function snapToSpeech(seconds: number, spans: SpeechSpan[]): number {
  if (!spans.length) return seconds;
  for (const [a, b] of spans) {
    if (seconds < a) return a;
    if (seconds <= b) return seconds;
  }
  return seconds;
}

/**
 * Frame timing for the words of one scene, or null when fewer than
 * `minMatched` (60%) of them were heard (numbers and compounds are often
 * written differently by the recogniser; those words sit between their heard
 * neighbours) (the caller keeps its estimate then).
 */
export function alignSceneWords(input: {
  words: string[];
  heard: HeardWord[];
  /** Where in `heard` to start looking (the previous scene's last match + 1). */
  from: number;
  fps: number;
  sceneStartFrame: number;
  sceneEndFrame: number;
  spans?: SpeechSpan[];
  minMatched?: number;
}): { words: TimedWord[]; next: number } | null {
  const { words, heard, fps } = input;
  const found: Array<number | null> = [];
  let cursor = input.from;
  for (const word of words) {
    const n = norm(word);
    let hit: number | null = null;
    if (n)
      for (let i = cursor; i < Math.min(heard.length, cursor + 8); i++)
        if (norm(heard[i]!.text) === n) {
          hit = i;
          break;
        }
    found.push(hit);
    if (hit !== null) cursor = hit + 1;
  }
  const matched = found.filter((i) => i !== null).length;
  if (matched < Math.ceil(words.length * (input.minMatched ?? 0.6)))
    return null;

  // Start of every word in seconds; unmatched words sit between their
  // matched neighbours.
  const starts: Array<number | null> = found.map((i) =>
    i === null ? null : snapToSpeech(heard[i]!.ms / 1000, input.spans ?? []),
  );
  const sceneStart = input.sceneStartFrame / fps;
  const sceneEnd = input.sceneEndFrame / fps;
  for (let i = 0; i < starts.length; i++) {
    if (starts[i] !== null) continue;
    let lo = i - 1;
    while (lo >= 0 && starts[lo] === null) lo--;
    let hi = i + 1;
    while (hi < starts.length && starts[hi] === null) hi++;
    const a = lo >= 0 ? starts[lo]! : sceneStart;
    const b = hi < starts.length ? starts[hi]! : sceneEnd;
    starts[i] = a + ((b - a) * (i - lo)) / (hi - lo);
  }
  const frames = starts.map((s) =>
    Math.min(
      input.sceneEndFrame - 1,
      Math.max(input.sceneStartFrame, Math.round(s! * fps)),
    ),
  );
  // Monotonic, and each word runs to the start of the next.
  for (let i = 1; i < frames.length; i++)
    frames[i] = Math.max(frames[i]!, frames[i - 1]!);
  const timed = words.map((text, i) => {
    const startFrame = frames[i]!;
    const nextStart = frames[i + 1] ?? input.sceneEndFrame;
    return {
      text,
      startFrame,
      endFrame: Math.max(startFrame + 1, Math.min(nextStart, startFrame + fps)),
    };
  });
  return {
    words: timed,
    next: cursor,
  };
}
