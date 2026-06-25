import { type VoiceModel, type VoiceProvider, type VoiceSummary } from "./types";

/**
 * Kokoro provider — in-browser, client-runtime TTS.
 *
 * Kokoro is an Apache-2.0 82M-parameter model that runs in the browser via
 * WASM/ONNX (kokoro-js). Synthesis happens entirely on the user's machine —
 * free, commercial-safe, no install, and zero load on the server. There is no
 * server-side synth(): the browser generates per-scene WAVs and uploads them via
 * /api/scripts/[id]/takes/upload. This stub exposes the curated voice/model
 * catalog so the editor's pickers work like any other provider.
 */
export const KOKORO_DEFAULT_MODEL = "kokoro-82M";

/** Hugging Face repo for the Kokoro ONNX weights (shared by client + server). */
export const KOKORO_MODEL_ID = "onnx-community/Kokoro-82M-v1.0-ONNX";

// Curated subset of kokoro-js voice ids. ids MUST match kokoro-js exactly.
// Shared by the in-browser and server-side Kokoro providers.
export const KOKORO_VOICES: VoiceSummary[] = [
  { id: "af_heart", name: "Heart — US female", category: "default", language: "en-US", tags: ["female"] },
  { id: "af_bella", name: "Bella — US female", category: "default", language: "en-US", tags: ["female"] },
  { id: "af_nicole", name: "Nicole — US female", category: "default", language: "en-US", tags: ["female"] },
  { id: "af_sarah", name: "Sarah — US female", category: "default", language: "en-US", tags: ["female"] },
  { id: "am_adam", name: "Adam — US male", category: "default", language: "en-US", tags: ["male"] },
  { id: "am_michael", name: "Michael — US male", category: "default", language: "en-US", tags: ["male"] },
  { id: "am_fenrir", name: "Fenrir — US male", category: "default", language: "en-US", tags: ["male"] },
  { id: "bf_emma", name: "Emma — UK female", category: "default", language: "en-GB", tags: ["female"] },
  { id: "bf_isabella", name: "Isabella — UK female", category: "default", language: "en-GB", tags: ["female"] },
  { id: "bm_george", name: "George — UK male", category: "default", language: "en-GB", tags: ["male"] },
  { id: "bm_lewis", name: "Lewis — UK male", category: "default", language: "en-GB", tags: ["male"] },
];

/** Kokoro model list (one model). Shared by the client + server providers. */
export function kokoroModels(): VoiceModel[] {
  return [{ id: KOKORO_DEFAULT_MODEL, label: "Kokoro 82M (Apache-2.0)" }];
}

/** Filter the curated Kokoro voices by an optional query. */
export function filterKokoroVoices(query?: string): VoiceSummary[] {
  if (!query) return KOKORO_VOICES;
  const q = query.toLowerCase();
  return KOKORO_VOICES.filter(
    (v) => v.name.toLowerCase().includes(q) || v.id.toLowerCase().includes(q),
  );
}

export function createKokoroProvider(): VoiceProvider {
  return {
    id: "kokoro",
    label: "Kokoro (in-browser, free)",
    runtime: "client",

    isConfigured: () => true,

    listModels: async () => kokoroModels(),
    listVoices: async (query?: string) => filterKokoroVoices(query),

    // No synth(): the browser generates audio and uploads it as a take.
  };
}
