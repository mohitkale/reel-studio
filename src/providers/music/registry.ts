import { type MusicProvider } from "./types";
import { createJamendoProvider } from "./jamendo";

/**
 * External music provider registry. Single provider (Jamendo) for now; add a
 * vendor (e.g. Pixabay Audio) by implementing MusicProvider and registering it here.
 */
let instance: MusicProvider | null = null;

export function getMusicProvider(): MusicProvider {
  if (!instance) instance = createJamendoProvider();
  return instance;
}
