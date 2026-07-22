/**
 * Resolve the voiceover script for a scene.
 * When `spokenText` is null/undefined, the on-screen `text` is spoken (default).
 * When `spokenText` is set (including ""), that value is used for TTS.
 */
export function resolveSpokenText(scene: {
  text: string;
  spokenText?: string | null;
}): string {
  if (scene.spokenText == null) return scene.text;
  return scene.spokenText;
}

/** True when there is non-whitespace content to send to TTS. */
export function hasSpokenContent(scene: {
  text: string;
  spokenText?: string | null;
}): boolean {
  return resolveSpokenText(scene).trim().length > 0;
}
