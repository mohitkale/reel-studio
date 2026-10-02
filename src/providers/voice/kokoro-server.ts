import {
  guardKokoroTokenizer,
  synthesizeSpeechChunks,
  createInferenceGate,
  KokoroQueueFull,
} from "@/lib/kokoro-chunks";
import { abortable } from "@/lib/deadline-fetch";
import type { KokoroTTS } from "kokoro-js";

import { pcmToWav, TARGET_SAMPLE_RATE } from "@/lib/wav";
import {
  KOKORO_DEFAULT_MODEL,
  KOKORO_MODEL_ID,
  filterKokoroVoices,
  kokoroModels,
} from "./kokoro";
import { enableExtendedKokoroVoices } from "./kokoro-extended-voices";
import {
  ProviderError,
  type SynthOptions,
  type SynthResult,
  type VoiceProvider,
} from "./types";

/**
 * Kokoro provider — server-side, runtime "server".
 *
 * Runs the same Apache-2.0 Kokoro 82M model as the in-browser provider, but via
 * onnxruntime-node on the server. Use this when you'd rather spend server CPU
 * than the user's device (e.g. weak clients, or long scripts). It needs no API
 * key; the weights download once from Hugging Face on first use and are cached.
 *
 * Node-only: kokoro-js / @huggingface/transformers / onnxruntime-node are
 * externalized from the bundle (see next.config.ts) and imported lazily so the
 * model only loads when this provider is actually used.
 */
export const KOKORO_SERVER_DEFAULT_MODEL = KOKORO_DEFAULT_MODEL;

const inference = createInferenceGate();

let ttsPromise: Promise<KokoroTTS> | null = null;

function loadModel(): Promise<KokoroTTS> {
  if (!ttsPromise) {
    ttsPromise = import("kokoro-js")
      .then(({ KokoroTTS }) =>
        KokoroTTS.from_pretrained(KOKORO_MODEL_ID, {
          dtype: "q8",
          device: "cpu",
        } as Parameters<typeof KokoroTTS.from_pretrained>[1]),
      )
      .then((tts) => {
        enableExtendedKokoroVoices(tts);
        guardKokoroTokenizer(tts);
        return tts;
      })
      .catch((e) => {
        ttsPromise = null; // allow retry
        throw e;
      });
  }
  return ttsPromise;
}

/** Linear resample a mono Float32 buffer (Kokoro outputs 24 kHz; pipeline is 44.1 kHz). */
function resampleLinear(
  input: Float32Array,
  srcRate: number,
  dstRate: number,
): Float32Array {
  if (srcRate === dstRate || input.length === 0) return input;
  const ratio = srcRate / dstRate;
  const outLength = Math.max(1, Math.round(input.length / ratio));
  const out = new Float32Array(outLength);
  for (let i = 0; i < outLength; i++) {
    const pos = i * ratio;
    const i0 = Math.floor(pos);
    const i1 = Math.min(i0 + 1, input.length - 1);
    const frac = pos - i0;
    out[i] = input[i0] * (1 - frac) + input[i1] * frac;
  }
  return out;
}

function floatToPcm16(samples: Float32Array): Buffer {
  const buf = Buffer.alloc(samples.length * 2);
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    buf.writeInt16LE(Math.round(s < 0 ? s * 0x8000 : s * 0x7fff), i * 2);
  }
  return buf;
}

export function createKokoroServerProvider(): VoiceProvider {
  return {
    id: "kokoro-server",
    label: "Kokoro (server, free)",
    runtime: "server",
    keyless: true,
    // CPU-bound local model on a single onnxruntime session — run one scene
    // at a time rather than contending for the same CPU cores.
    maxConcurrency: 1,

    isConfigured: () => true,

    listModels: async () => kokoroModels(),
    listVoices: async (query?: string) => filterKokoroVoices(query),

    async synth(opts: SynthOptions): Promise<SynthResult> {
      const deadline = new AbortController();
      const timer = setTimeout(
        () =>
          deadline.abort(
            new DOMException(
              "Kokoro synthesis deadline exceeded",
              "TimeoutError",
            ),
          ),
        120_000,
      );
      const signal = opts.signal
        ? AbortSignal.any([opts.signal, deadline.signal])
        : deadline.signal;
      try {
        signal.throwIfAborted();
        let tts: KokoroTTS;
        try {
          tts = await abortable(loadModel(), signal);
        } catch (e) {
          throw new ProviderError(
            `Could not load the Kokoro model on the server: ${
              e instanceof Error ? e.message : String(e)
            }`,
            502,
            "kokoro-server",
          );
        }

        // Clamp speed to Kokoro's practical range (slightly slow reads more natural).
        const speed =
          typeof opts.speed === "number" && Number.isFinite(opts.speed)
            ? Math.min(1.35, Math.max(0.7, opts.speed))
            : 1;
        const audio = await inference(
          () =>
            synthesizeSpeechChunks(
              opts.text,
              (text) =>
                tts.generate(text, { voice: opts.voiceId, speed } as Parameters<
                  typeof tts.generate
                >[1]),
              signal,
            ),
          signal,
        );
        const target = opts.sampleRate ?? TARGET_SAMPLE_RATE;
        const resampled = resampleLinear(
          audio.audio,
          audio.sampling_rate,
          target,
        );
        const wav = pcmToWav(floatToPcm16(resampled), {
          sampleRate: target,
          channels: 1,
          bitsPerSample: 16,
        });
        return { wav, sampleRate: target };
      } catch (error) {
        if (opts.signal?.aborted) throw opts.signal.reason ?? error;
        if (deadline.signal.aborted)
          throw new ProviderError(
            "Kokoro synthesis timed out after 120s",
            504,
            "kokoro-server",
          );
        if (error instanceof ProviderError) throw error;
        if (error instanceof KokoroQueueFull)
          throw new ProviderError(error.message, 503, "kokoro-server");
        throw new ProviderError(
          error instanceof Error ? error.message : "Kokoro synthesis failed",
          502,
          "kokoro-server",
        );
      } finally {
        clearTimeout(timer);
      }
    },
  };
}
