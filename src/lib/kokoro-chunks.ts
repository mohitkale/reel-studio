import type { KokoroTTS } from "kokoro-js";
import { abortable } from "@/lib/deadline-fetch";

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

export async function synthesizeSpeechChunks(
  text: string,
  generate: (
    text: string,
  ) => Promise<{ audio: Float32Array; sampling_rate: number }>,
  signal?: AbortSignal,
) {
  const audio: Float32Array[] = [];
  let rate: number | undefined;
  const synth = async (chunk: string): Promise<void> => {
    signal?.throwIfAborted();
    try {
      const result = await generate(chunk);
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
      await synth(chunk.slice(0, cut).trim());
      await synth(chunk.slice(cut).trim());
    }
  };
  for (const chunk of splitSpeechText(text)) await synth(chunk);
  if (!rate) throw new Error("No spoken text to synthesize");
  const combined = new Float32Array(
    audio.reduce((n, part) => n + part.length, 0),
  );
  let offset = 0;
  for (const part of audio) {
    combined.set(part, offset);
    offset += part.length;
  }
  return { audio: combined, sampling_rate: rate };
}

/** One session at a time; a canceled active native call retains the gate until it settles. */
export function createInferenceGate() {
  let tail = Promise.resolve();
  return <T>(run: () => Promise<T>, signal?: AbortSignal): Promise<T> => {
    signal?.throwIfAborted();
    const task = tail.then(() => {
      signal?.throwIfAborted();
      return run();
    });
    tail = task.then(
      () => {},
      () => {},
    );
    return abortable(task, signal);
  };
}
