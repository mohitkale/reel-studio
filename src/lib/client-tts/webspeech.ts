/**
 * Web Speech API preview (client runtime, preview only).
 *
 * Speaks text through the browser's built-in voices. There is no way to capture
 * the audio, so this can never produce a take or be rendered — it is an instant,
 * free scratch-track preview inside the editor.
 */

export function isWebSpeechSupported(): boolean {
  return typeof window !== "undefined" && "speechSynthesis" in window;
}

/** Resolve the browser's available voices (handles the async voiceschanged load). */
export function getWebSpeechVoices(): Promise<SpeechSynthesisVoice[]> {
  return new Promise((resolve) => {
    if (!isWebSpeechSupported()) return resolve([]);

    const filterToGoogle = (all: SpeechSynthesisVoice[]) =>
      all.filter((v) => v.name.startsWith("Google"));

    const existing = window.speechSynthesis.getVoices();
    if (existing.length) return resolve(filterToGoogle(existing));

    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      resolve(filterToGoogle(window.speechSynthesis.getVoices()));
    };
    window.speechSynthesis.addEventListener?.("voiceschanged", finish, {
      once: true,
    });
    // Fallback if voiceschanged never fires.
    setTimeout(finish, 600);
  });
}

/** Speak text immediately (cancels anything in progress). */
export function speak(text: string, voiceURI?: string): void {
  if (!isWebSpeechSupported() || !text.trim()) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  if (voiceURI) {
    const voice = window.speechSynthesis
      .getVoices()
      .find((v) => v.voiceURI === voiceURI);
    if (voice) utterance.voice = voice;
  }
  window.speechSynthesis.speak(utterance);
}

export function cancelSpeech(): void {
  if (isWebSpeechSupported()) window.speechSynthesis.cancel();
}
