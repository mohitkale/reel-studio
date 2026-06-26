/**
 * Kokoro TTS Web Worker.
 *
 * Runs the model's WASM inference OFF the main thread so generating many scenes
 * never freezes the page (which otherwise triggers the browser's "page
 * unresponsive" dialog). Scenes are synthesized one at a time on request; each
 * result's audio is resampled, encoded and base64'd here, then posted back, so
 * the main thread never holds raw PCM and peak memory stays low.
 */
import { KokoroTTS } from "kokoro-js";

import {
  resampleLinear,
  encodeWavPcm16,
  arrayBufferToBase64,
  silentWavBase64,
  TARGET_SAMPLE_RATE,
} from "./wav-encode";

const MODEL_ID = "onnx-community/Kokoro-82M-v1.0-ONNX";

// Typed handle to the worker global without pulling in the conflicting webworker lib.
const ctx = self as unknown as {
  postMessage: (msg: unknown) => void;
  onmessage: ((e: MessageEvent) => void) | null;
};

// kokoro-js lazy-fetches each voice's style vector from HuggingFace's CDN
// (…/Kokoro-82M-v1.0-ONNX/resolve/main/voices/<id>.bin). Networks that block
// that CDN leave only previously-cached voices working. Redirect those fetches
// to our own same-origin route, which serves the files bundled in
// node_modules/kokoro-js/voices — so every voice works without hitting HF.
const VOICE_URL_RE =
  /Kokoro-82M-v1\.0-ONNX\/resolve\/[^/]+\/voices\/([a-z]{2}_[a-z]+)\.bin(?:\?.*)?$/;
const realFetch = globalThis.fetch.bind(globalThis);
globalThis.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
  const url =
    typeof input === "string"
      ? input
      : input instanceof URL
        ? input.href
        : input.url;
  const match = url.match(VOICE_URL_RE);
  if (match) return realFetch(`/api/kokoro-voice/${match[1]}`, init);
  return realFetch(input as RequestInfo, init);
}) as typeof fetch;

let ttsPromise: Promise<KokoroTTS> | null = null;

function load(): Promise<KokoroTTS> {
  if (!ttsPromise) {
    ttsPromise = KokoroTTS.from_pretrained(MODEL_ID, {
      dtype: "q8",
      device: "wasm",
      progress_callback: (p: { progress?: number }) =>
        ctx.postMessage({ type: "progress", progress: p?.progress }),
    } as Parameters<typeof KokoroTTS.from_pretrained>[1]).catch((e) => {
      ttsPromise = null; // allow retry
      throw e;
    });
  }
  return ttsPromise;
}

ctx.onmessage = async (e: MessageEvent) => {
  const msg = e.data as {
    type: string;
    id?: number;
    text?: string;
    voice?: string;
  };
  if (msg.type !== "synth") return;

  try {
    const text = (msg.text ?? "").trim();
    let wavBase64: string;
    if (!text) {
      wavBase64 = silentWavBase64(0.6);
    } else {
      const tts = await load();
      const audio = await tts.generate(
        text,
        { voice: msg.voice } as Parameters<typeof tts.generate>[1],
      );
      const resampled = resampleLinear(
        audio.audio,
        audio.sampling_rate,
        TARGET_SAMPLE_RATE,
      );
      wavBase64 = arrayBufferToBase64(encodeWavPcm16(resampled, TARGET_SAMPLE_RATE));
    }
    ctx.postMessage({ type: "result", id: msg.id, wavBase64 });
  } catch (err) {
    ctx.postMessage({
      type: "error",
      id: msg.id,
      message: err instanceof Error ? err.message : String(err),
    });
  }
};
