import { type VoiceModel, type VoiceProvider } from "./types";

/**
 * Web Speech API provider — PREVIEW ONLY.
 *
 * The browser's SpeechSynthesis speaks through the speakers and exposes no
 * capturable audio buffer, and the headless Chrome used for rendering has no
 * system voices. So this can never be a render audio source: it has no synth()
 * and never produces a stored take. It exists purely as an instant, free,
 * zero-install scratch-track preview inside the editor. Actual voices are
 * enumerated client-side via speechSynthesis.getVoices().
 */
export const WEBSPEECH_DEFAULT_MODEL = "system";

export function createWebSpeechProvider(): VoiceProvider {
  return {
    id: "webspeech",
    label: "Browser preview (Web Speech)",
    runtime: "client",
    preview: true,

    isConfigured: () => true,

    async listModels(): Promise<VoiceModel[]> {
      return [{ id: WEBSPEECH_DEFAULT_MODEL, label: "System voices" }];
    },

    async listVoices() {
      // Real voices are OS/browser specific; the editor enumerates them live.
      return [];
    },

    // No synth(): preview only, never persisted.
  };
}
