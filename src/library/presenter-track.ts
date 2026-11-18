import { createHash } from "node:crypto";

import type { PresenterTrack } from "@/engines/hyperframes/presenter/build-presenter";
import { parseWav } from "@/lib/wav";
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

/**
 * Everything the presenter does over time for some narration: mouth shapes from
 * the words' phonemes and times, blinks, nods and eyebrow raises. English words
 * use eSpeak phonemes; any word it cannot read (another script, a symbol), and
 * every word when eSpeak is unavailable, follows the loudness of the audio.
 */
export async function buildPresenterTrack(input: {
  words: readonly TimedWord[];
  wav: Buffer;
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
  const energy = loudness(input.wav);
  const seed = createHash("sha256").update(input.seed).digest().readUInt32BE(0);
  return {
    mouth: mouthTrack(input.words, (word) => ipa.get(word), energy),
    blinks: blinkTrack(input.seconds, seed),
    accents: accentTrack(input.words),
  };
}
