import type { KokoroTTS } from "kokoro-js";

const patched = new WeakSet<object>();

/**
 * kokoro-js 1.2.1 only registers English voices in its VOICES table, but ships
 * style-vector `.bin` files for all 54 Kokoro-82M voices (Hindi, Japanese, etc.).
 *
 * Patch `_validate_voice` so those ids work. For unregistered voices we return
 * `"a"` so G2P uses American English — correct for Latin-script dialogue spoken
 * with a multilingual voice (e.g. Hindi `hm_omega` reading English lines).
 */
export function enableExtendedKokoroVoices(tts: KokoroTTS): void {
  if (patched.has(tts)) return;
  patched.add(tts);

  const mutable = tts as KokoroTTS & {
    _validate_voice: (voice: string) => string;
  };
  mutable._validate_voice = (voice: string) => {
    if (Object.prototype.hasOwnProperty.call(tts.voices, voice)) {
      return voice.charAt(0);
    }
    return "a";
  };
}
