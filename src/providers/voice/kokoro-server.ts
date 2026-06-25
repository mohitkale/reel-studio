import type { KokoroTTS } from "kokoro-js";

import { pcmToWav, TARGET_SAMPLE_RATE } from "@/lib/wav";
import {
  KOKORO_DEFAULT_MODEL,
  KOKORO_MODEL_ID,
  filterKokoroVoices,
  kokoroModels,
} from "./kokoro";
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

    isConfigured: () => true,

    listModels: async () => kokoroModels(),
    listVoices: async (query?: string) => filterKokoroVoices(query),

    async synth(opts: SynthOptions): Promise<SynthResult> {
      let tts: KokoroTTS;
      try {
        tts = await loadModel();
      } catch (e) {
        throw new ProviderError(
          `Could not load the Kokoro model on the server: ${
            e instanceof Error ? e.message : String(e)
          }`,
          502,
          "kokoro-server",
        );
      }

      const audio = await tts.generate(
        opts.text,
        { voice: opts.voiceId } as Parameters<typeof tts.generate>[1],
      );
      const target = opts.sampleRate ?? TARGET_SAMPLE_RATE;
      const resampled = resampleLinear(audio.audio, audio.sampling_rate, target);
      const wav = pcmToWav(floatToPcm16(resampled), {
        sampleRate: target,
        channels: 1,
        bitsPerSample: 16,
      });
      return { wav, sampleRate: target };
    },
  };
}
