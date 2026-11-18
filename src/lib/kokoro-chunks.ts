import type { KokoroTTS } from "kokoro-js";

export class KokoroTokenLimit extends Error {}
const guarded = new WeakSet<object>();
/** kokoro-js 1.2.1 otherwise silently truncates phonemes. Guard the exact tokenizer input. */
export function guardKokoroTokenizer(tts: Pick<KokoroTTS, "tokenizer">) {
  if (guarded.has(tts)) return;
  const original = tts.tokenizer;
  tts.tokenizer = new Proxy(original, {
    apply(target, receiver, args: unknown[]) {
      const options = args[1] && typeof args[1] === "object" ? args[1] : {};
      const encoded = Reflect.apply(target, receiver, [
        args[0],
        { ...options, truncation: false },
      ]) as { input_ids: { dims: number[] } };
      if (encoded.input_ids.dims.at(-1)! > 510)
        throw new KokoroTokenLimit("Kokoro chunk exceeds the token budget");
      return encoded;
    },
  });
  guarded.add(tts);
}

export function splitSpeechText(text: string, maxChars = 220): string[] {
  const parts =
    text.match(/[^.!?。！？\n]+[.!?。！？]*\s*|[.!?。！？]+/gu) ?? [];
  const chunks: string[] = [];
  for (const part of parts) {
    let remaining = part.trim();
    while (remaining.length > maxChars) {
      let cut = remaining.lastIndexOf(" ", maxChars);
      if (cut < maxChars / 2) cut = maxChars;
      // Do not split a surrogate pair.
      if (/[\uD800-\uDBFF]/.test(remaining[cut - 1])) cut--;
      chunks.push(remaining.slice(0, cut).trim());
      remaining = remaining.slice(cut).trim();
    }
    if (remaining) chunks.push(remaining);
  }
  return chunks;
}

/** Pauses and the opening pace for a line of narration (roadmap A2). Seconds. */
export interface Pacing {
  /** Silence between sentences. */
  sentence: number;
  /** Silence between paragraphs (a blank line in the text). */
  paragraph: number;
  /** Extra silence before a punchline or a stat. */
  emphasis: number;
  /** The first sentence is read a little slower: 1 is unchanged. */
  firstSentenceSpeed: number;
}

export const DEFAULT_PACING: Pacing = {
  sentence: 0.16,
  paragraph: 0.4,
  emphasis: 0.2,
  firstSentenceSpeed: 0.95,
};

export const NO_PACING: Pacing = {
  sentence: 0,
  paragraph: 0,
  emphasis: 0,
  firstSentenceSpeed: 1,
};

export interface PacedChunk {
  text: string;
  /** Seconds of silence before this chunk. */
  pauseBefore: number;
  /** Multiplier on the voice speed for this chunk. */
  speed: number;
}

const STARTS_WITH_NUMBER =
  /^(?:[\p{Sc}]?\d|(?:zero|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety|hundred|thousand|million|billion)\b)/iu;

const wordCount = (text: string) => text.split(/\s+/).filter(Boolean).length;

/**
 * Split narration into sentences and decide, with plain rules, how long to wait
 * before each and how fast to read it. The same text always gives the same plan.
 */
export function planPacing(
  text: string,
  pacing: Pacing = DEFAULT_PACING,
): PacedChunk[] {
  const out: PacedChunk[] = [];
  const paragraphs = text.split(/\n\s*\n/);
  for (const paragraph of paragraphs) {
    const sentences = splitSpeechText(paragraph);
    for (const [i, sentence] of sentences.entries()) {
      const first = out.length === 0;
      let pause = 0;
      if (!first) pause = i === 0 ? pacing.paragraph : pacing.sentence;
      // A short line after longer ones, or a number, lands harder with a beat before it.
      const punchline =
        !first &&
        i > 0 &&
        i === sentences.length - 1 &&
        wordCount(sentence) <= 5 &&
        wordCount(sentences[i - 1]!) > 6;
      // Narration is normalised first, so a stat often starts with a number word.
      const stat = !first && STARTS_WITH_NUMBER.test(sentence);
      if (punchline || stat) pause += pacing.emphasis;
      out.push({
        text: sentence,
        pauseBefore: pause,
        speed: first ? pacing.firstSentenceSpeed : 1,
      });
    }
  }
  return out;
}

export async function synthesizeSpeechChunks(
  text: string,
  generate: (
    text: string,
    speedFactor?: number,
  ) => Promise<{ audio: Float32Array; sampling_rate: number }>,
  signal?: AbortSignal,
  pacing: Pacing = DEFAULT_PACING,
) {
  const audio: Float32Array[] = [];
  let rate: number | undefined;
  const synth = async (chunk: string, speedFactor = 1): Promise<void> => {
    signal?.throwIfAborted();
    try {
      const result = await generate(chunk, speedFactor);
      signal?.throwIfAborted();
      if (
        !result.audio.length ||
        !Number.isFinite(result.sampling_rate) ||
        result.sampling_rate <= 0
      )
        throw new Error("Kokoro returned empty audio");
      if (rate !== undefined && rate !== result.sampling_rate)
        throw new Error("Kokoro chunk sample rates differ");
      rate = result.sampling_rate;
      audio.push(result.audio);
    } catch (error) {
      if (!(error instanceof KokoroTokenLimit) || chunk.length < 2) throw error;
      let cut = Math.floor(chunk.length / 2);
      const space = chunk.lastIndexOf(" ", cut);
      if (space > cut / 2) cut = space;
      if (/[\uD800-\uDBFF]/.test(chunk[cut - 1])) cut--;
      if (!cut) throw error;
      await synth(chunk.slice(0, cut).trim(), speedFactor);
      await synth(chunk.slice(cut).trim(), speedFactor);
    }
  };
  const plan = planPacing(text, pacing);
  /** Audio parts and the silence wanted before each, in order. */
  const gaps: number[] = [];
  for (const chunk of plan) {
    const before = audio.length;
    await synth(chunk.text, chunk.speed);
    // A split chunk adds several parts; the pause goes before the first.
    for (let i = before; i < audio.length; i++)
      gaps[i] = i === before ? chunk.pauseBefore : 0;
  }
  if (!rate) throw new Error("No spoken text to synthesize");
  const silences = gaps.map((seconds) => Math.round((seconds ?? 0) * rate!));
  const combined = new Float32Array(
    audio.reduce((n, part) => n + part.length, 0) +
      silences.reduce((n, length) => n + length, 0),
  );
  let offset = 0;
  for (const [i, part] of audio.entries()) {
    offset += silences[i] ?? 0; // zeros: the array starts silent
    combined.set(part, offset);
    offset += part.length;
  }
  return { audio: combined, sampling_rate: rate };
}

export class KokoroQueueFull extends Error {}

/** A canceled active native call retains ownership until it settles. Canceled
 * queued calls release their captured inputs immediately, even if native code hangs. */
export function createInferenceGate(maxPending = 64) {
  let active = false;
  const pending: Array<() => void> = [];
  const pump = () => {
    if (active) return;
    const next = pending.shift();
    if (next) {
      active = true;
      next();
    }
  };
  return <T>(run: () => Promise<T>, signal?: AbortSignal): Promise<T> => {
    signal?.throwIfAborted();
    if (active && pending.length >= maxPending)
      return Promise.reject(
        new KokoroQueueFull("Kokoro inference queue is full; retry later"),
      );
    return new Promise<T>((resolve, reject) => {
      let started = false;
      const cleanup = () => signal?.removeEventListener("abort", onAbort);
      const start = () => {
        started = true;
        void Promise.resolve()
          .then(() => {
            signal?.throwIfAborted();
            return run();
          })
          .then(resolve, reject)
          .finally(() => {
            cleanup();
            active = false;
            pump();
          });
      };
      const onAbort = () => {
        reject(signal?.reason ?? new DOMException("Aborted", "AbortError"));
        cleanup();
        if (!started) {
          const index = pending.indexOf(start);
          if (index >= 0) pending.splice(index, 1);
          pump();
        }
      };
      pending.push(start);
      signal?.addEventListener("abort", onAbort, { once: true });
      pump();
    });
  };
}
