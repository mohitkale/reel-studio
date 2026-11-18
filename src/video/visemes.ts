/**
 * Lip sync for the animated presenter (roadmap P1). Phonemes become one of
 * twelve mouth shapes, spread over each word's measured time. Plain rules, no
 * model, and the same words always give the same mouth. Engine-neutral: nothing
 * here knows about HTML or SVG.
 */
export const VISEMES = [
  "rest", // closed, relaxed
  "ah", // wide open: father, cat
  "eh", // half open: bed, about
  "ee", // spread: see, sit
  "oh", // round open: go, saw
  "oo", // small round: you, wow
  "mbp", // lips pressed: m, b, p
  "fv", // lower lip under upper teeth: f, v
  "l", // tongue up, teeth apart: l, n, d, t
  "sz", // teeth close together: s, z, th
  "r", // pursed: r, er
  "sh", // rounded and narrow: sh, ch, j
] as const;
export type Viseme = (typeof VISEMES)[number];

/** IPA symbol (one character, length marks and stress ignored) to a mouth shape. */
const BY_SYMBOL: Record<string, Viseme> = {};
const assign = (viseme: Viseme, symbols: string) => {
  for (const symbol of symbols) BY_SYMBOL[symbol] = viseme;
};
assign("ah", "ɑaæʌɐɒ");
assign("eh", "ɛeəɜɚɘ");
assign("ee", "iɪyj");
assign("oh", "ɔoøœ");
assign("oo", "uʊwɯ");
assign("mbp", "mbp");
assign("fv", "fvʋ");
assign("l", "lnɫdtɲŋ");
assign("sz", "szθðɕʑ");
assign("r", "ɹrɾɻɝ");
assign("sh", "ʃʒ");
// Back and glottal sounds barely show on the lips.
assign("eh", "kgɡhʔxɣ");

const VOWELS = new Set("ɑaæʌɐɒɛeəɜɚɘiɪyɔoøœuʊɯ");

export interface Phoneme {
  viseme: Viseme;
  /** Relative length within the word: vowels are held longer than stops. */
  weight: number;
}

/** The mouth shapes for one word's IPA. Stress, length marks and spaces are skipped. */
export function phonemesToVisemes(ipa: string): Phoneme[] {
  const out: Phoneme[] = [];
  for (const symbol of ipa) {
    const viseme = BY_SYMBOL[symbol];
    if (!viseme) continue;
    const vowel = VOWELS.has(symbol);
    const stop = "bpdtkgɡ".includes(symbol);
    const weight = vowel ? 2 : stop ? 0.6 : 1;
    const previous = out[out.length - 1];
    // Two of the same shape in a row are one longer shape.
    if (previous && previous.viseme === viseme) previous.weight += weight;
    else out.push({ viseme, weight });
  }
  return out;
}

export interface TimedWord {
  text: string;
  start: number;
  end: number;
}

export interface MouthKey {
  viseme: Viseme;
  start: number;
  end: number;
}

const MIN_KEY_SECONDS = 0.05;

/**
 * The mouth over time. Each word's time is divided among its phonemes by weight;
 * between words, and in pauses, the mouth rests. `phonemes` returns a word's IPA
 * or undefined when the language is not covered, in which case that word's mouth
 * follows `energy` (loudness 0 to 1 at a time) instead.
 */
export function mouthTrack(
  words: readonly TimedWord[],
  phonemes: (word: string) => string | undefined,
  energy?: (seconds: number) => number,
): MouthKey[] {
  const keys: MouthKey[] = [];
  const push = (viseme: Viseme, start: number, end: number) => {
    if (end - start < 0.001) return;
    const last = keys[keys.length - 1];
    if (last && last.viseme === viseme && start - last.end < 0.02)
      last.end = end;
    else keys.push({ viseme, start, end });
  };
  let cursor = 0;
  for (const word of words) {
    if (word.start > cursor) push("rest", cursor, word.start);
    const start = Math.max(word.start, cursor);
    const span = Math.max(MIN_KEY_SECONDS, word.end - start);
    const ipa = phonemes(word.text);
    const parts = ipa ? phonemesToVisemes(ipa) : [];
    if (parts.length === 0) {
      // No phonemes (another language, a symbol): open and close with the voice.
      const step = 0.08;
      for (let t = start; t < start + span; t += step) {
        const level = energy ? energy(t + step / 2) : 0.6;
        push(
          level > 0.66 ? "ah" : level > 0.3 ? "eh" : "rest",
          t,
          Math.min(start + span, t + step),
        );
      }
    } else {
      // Keys shorter than the minimum are folded into the longest neighbour.
      const total = parts.reduce((sum, p) => sum + p.weight, 0);
      let t = start;
      for (const part of parts) {
        const length = (part.weight / total) * span;
        push(part.viseme, t, t + length);
        t += length;
      }
    }
    cursor = start + span;
  }
  return mergeShort(keys);
}

/** Drop keys too short to see by giving their time to the previous key. */
function mergeShort(keys: MouthKey[]): MouthKey[] {
  const out: MouthKey[] = [];
  for (const key of keys) {
    const last = out[out.length - 1];
    if (last && key.end - key.start < MIN_KEY_SECONDS) last.end = key.end;
    else out.push({ ...key });
  }
  return out;
}

/** A mouth that follows loudness only, for audio with no usable phonemes. Samples `energy` at `hz`. */
export function amplitudeTrack(
  energy: (seconds: number) => number,
  seconds: number,
  hz = 12,
): MouthKey[] {
  const keys: MouthKey[] = [];
  const step = 1 / hz;
  for (let t = 0; t < seconds; t += step) {
    const level = energy(t + step / 2);
    const viseme: Viseme =
      level > 0.66 ? "ah" : level > 0.38 ? "eh" : level > 0.12 ? "oo" : "rest";
    const end = Math.min(seconds, t + step);
    const last = keys[keys.length - 1];
    if (last && last.viseme === viseme) last.end = end;
    else keys.push({ viseme, start: t, end });
  }
  return keys;
}

export interface Blink {
  start: number;
  end: number;
}

/** A small deterministic generator (mulberry32) so blinks never change between renders. */
function seeded(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A blink every 2.5 to 5.5 seconds, 0.14 s long, the same for the same seed. */
export function blinkTrack(seconds: number, seed: number): Blink[] {
  const random = seeded(seed);
  const blinks: Blink[] = [];
  let t = 1 + random() * 1.5;
  while (t < seconds - 0.2) {
    blinks.push({ start: t, end: t + 0.14 });
    t += 2.5 + random() * 3;
  }
  return blinks;
}

export interface Accent {
  at: number;
  kind: "nod" | "brows";
}

const EMPHASIS =
  /^(never|always|only|must|every|first|most|best|worst|biggest|huge|key|important|really|\d)/i;

/**
 * A head nod on a word that carries emphasis (a number, or a strong word at the
 * end of a sentence) and raised eyebrows on a question or an exclamation.
 * At least 1.2 seconds apart so the head does not bob.
 */
export function accentTrack(words: readonly TimedWord[]): Accent[] {
  const out: Accent[] = [];
  const add = (at: number, kind: Accent["kind"]) => {
    const last = out[out.length - 1];
    if (!last || at - last.at >= 1.2 || last.kind !== kind)
      out.push({ at, kind });
  };
  for (const word of words) {
    if (/[?!]$/.test(word.text)) add(Math.max(0, word.start - 0.4), "brows");
    else if (EMPHASIS.test(word.text.replace(/^[^\p{L}\p{N}]+/u, "")))
      add(word.start, "nod");
  }
  return out;
}
