import { createHash } from "node:crypto";

import type { PresenterTrack } from "@/engines/hyperframes/presenter/build-presenter";
import { parseWav } from "@/lib/wav";
import type { ReelCaptionCue } from "@/video/types";
import {
  accentTrack,
  blinkTrack,
  mouthTrack,
  type TimedWord,
} from "@/video/visemes";

/** Loudness (0 to 1) over time from a 16-bit WAV: RMS in 25 ms windows against the 95th percentile. */
export function loudness(wav: Buffer): (seconds: number) => number {
  const info = parseWav(wav);
  if (info.bitsPerSample !== 16) return () => 0.5;
  const window = Math.max(1, Math.floor(info.sampleRate * 0.025));
  const frames = Math.floor(info.dataLength / 2 / info.channels);
  const count = Math.max(1, Math.floor(frames / window));
  const rms: number[] = [];
  for (let w = 0; w < count; w++) {
    let sum = 0;
    for (let i = 0; i < window; i++) {
      const at = info.dataOffset + (w * window + i) * info.channels * 2;
      const value = wav.readInt16LE(at) / 32768;
      sum += value * value;
    }
    rms.push(Math.sqrt(sum / window));
  }
  const high =
    [...rms].sort((a, b) => a - b)[Math.floor(rms.length * 0.95)] || 1;
  return (seconds) => {
    const index = Math.min(
      rms.length - 1,
      Math.max(0, Math.floor(seconds / 0.025)),
    );
    return Math.min(1, rms[index]! / high);
  };
}

type Phonemize = (text: string, language?: string) => Promise<string[]>;

async function loadPhonemizer(): Promise<Phonemize | undefined> {
  try {
    return (await import("phonemizer")).phonemize as Phonemize;
  } catch {
    return undefined;
  }
}

const SOUNDING = 0.12;

/**
 * Word times from a recogniser run into the pause that follows (a word ends where
 * the next begins) and start a little late. With the audio at hand, each word is
 * pulled back to where the voice actually sounds: its end moves to the last
 * sounding moment inside it, and its start moves up to 120 ms earlier while the
 * voice is already sounding. The mouth then rests in pauses and opens on time.
 */
export function fitWordsToSound(
  words: readonly TimedWord[],
  sound: (seconds: number) => number,
): TimedWord[] {
  const out: TimedWord[] = [];
  for (const word of words) {
    // Onset: the first sounding moment from 120 ms before the word's start to its
    // end. A recogniser may put a word's start inside the silence before it.
    let start: number | undefined;
    for (let t = Math.max(0, word.start - 0.12); t < word.end; t += 0.01)
      if (sound(t) > SOUNDING) {
        start = t;
        break;
      }
    if (start === undefined) {
      // Nothing sounds inside this word's time: keep it as a blink of a mouth.
      const at = Math.max(
        word.start,
        out.length ? out[out.length - 1]!.end : 0,
      );
      out.push({ text: word.text, start: at, end: at + 0.06 });
      continue;
    }
    let end = start + 0.06;
    // The word ends at the first stretch of silence (100 ms) after it began: a
    // sound after that belongs to the next word, even if the times overlap.
    for (let t = start; t < word.end; t += 0.01) {
      if (sound(t) > SOUNDING) end = t + 0.03;
      else if (t - end > 0.1) break;
    }
    // Never overlap the word before.
    const floor = out.length ? out[out.length - 1]!.end : 0;
    start = Math.max(start, floor);
    out.push({
      text: word.text,
      start,
      end: Math.max(start + 0.06, Math.min(end, word.end + 0.05)),
    });
  }
  return out;
}

/**
 * Everything the presenter does over time for some narration: mouth shapes from
 * the words' phonemes and times, blinks, nods and eyebrow raises. English words
 * use eSpeak phonemes; any word it cannot read (another script, a symbol), and
 * every word when eSpeak is unavailable, follows the loudness of the audio.
 */
export async function buildPresenterTrack(input: {
  words: readonly TimedWord[];
  /** The narration audio, for the loudness fallback. Without it that fallback is a steady half-open mouth. */
  wav?: Buffer;
  /** Seconds the audio starts after time zero (a cover frame before the narration). */
  audioOffset?: number;
  seconds: number;
  /** Anything stable, such as the title, so the blinks are the same every render. */
  seed: string;
  language?: string;
}): Promise<PresenterTrack> {
  const english =
    !input.language ||
    input.language === "auto" ||
    input.language.startsWith("en");
  const phonemize = english ? await loadPhonemizer() : undefined;
  const ipa = new Map<string, string | undefined>();
  if (phonemize)
    for (const word of new Set(input.words.map((w) => w.text))) {
      const letters = word.replace(/[^\p{L}']/gu, "");
      if (!/^[A-Za-z']+$/.test(letters)) {
        ipa.set(word, undefined);
        continue;
      }
      try {
        ipa.set(
          word,
          (await phonemize(letters.toLowerCase(), "en-us")).join(" "),
        );
      } catch {
        ipa.set(word, undefined);
      }
    }
  let voice: ((seconds: number) => number) | undefined;
  try {
    voice = input.wav ? loudness(input.wav) : undefined;
  } catch {
    voice = undefined; // not a WAV this code can read: the mouth follows the words only
  }
  const offset = input.audioOffset ?? 0;
  const energy = voice ? (t: number) => voice(t - offset) : undefined;
  const seed = createHash("sha256").update(input.seed).digest().readUInt32BE(0);
  return {
    mouth: mouthTrack(
      energy ? fitWordsToSound(input.words, energy) : input.words,
      (word) => ipa.get(word),
      energy,
    ),
    blinks: blinkTrack(input.seconds, seed),
    accents: accentTrack(input.words),
  };
}

/**
 * The presenter's track for a whole video, from its captions: every cue's words
 * with their times (spread evenly across the cue when it has no word times),
 * moved past the cover frame to where the narration really starts.
 */
export async function buildReelPresenterTrack(args: {
  cues: ReadonlyArray<ReelCaptionCue>;
  fps: number;
  coverSeconds: number;
  totalSeconds: number;
  seed: string;
  /** The narration audio, to rest the mouth in pauses. */
  wav?: Buffer;
}): Promise<PresenterTrack> {
  const words: TimedWord[] = args.cues.flatMap((cue) => {
    if (cue.words?.length)
      return cue.words.map((w) => ({
        text: w.text,
        start: args.coverSeconds + w.startFrame / args.fps,
        end: args.coverSeconds + w.endFrame / args.fps,
      }));
    const parts = cue.text.split(/\s+/).filter(Boolean);
    if (parts.length === 0) return [];
    const start = args.coverSeconds + cue.startFrame / args.fps;
    const span = (cue.endFrame - cue.startFrame) / args.fps / parts.length;
    return parts.map((text, i) => ({
      text,
      start: start + i * span,
      end: start + (i + 1) * span,
    }));
  });
  return buildPresenterTrack({
    words,
    wav: args.wav,
    audioOffset: args.coverSeconds,
    seconds: args.totalSeconds,
    seed: args.seed,
  });
}
