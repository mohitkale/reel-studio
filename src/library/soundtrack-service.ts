import type { SceneMood } from "@/compositions/types";
import {
  MUSIC_LIBRARY,
  suggestBundledTrack,
  type MusicTrack,
} from "@/lib/music-library";
import { getScript, updateScript } from "@/library/repositories/scripts";

const MUSIC_MOOD_KEYWORDS: Array<{ re: RegExp; mood: SceneMood }> = [
  { re: /lo-?fi|chill|calm|soft|focus|warm|gentle/, mood: "calm" },
  { re: /cinematic|drama|tension|dark|intense/, mood: "dramatic" },
  { re: /upbeat|energy|energetic|hype|drive|punch/, mood: "energetic" },
  { re: /playful|fun|quirky|bounce/, mood: "playful" },
  { re: /tech|digital|product|minimal/, mood: "tech" },
  { re: /inspir|hope|golden|uplift/, mood: "inspiring" },
  { re: /nature|acoustic|organic|forest/, mood: "nature" },
];

function mostCommonMood(
  moods: Array<SceneMood | string | null | undefined>,
): SceneMood | undefined {
  const counts = new Map<string, number>();
  for (const m of moods) {
    if (!m) continue;
    counts.set(m, (counts.get(m) ?? 0) + 1);
  }
  let best: string | undefined;
  let bestCount = 0;
  for (const [v, c] of counts) {
    if (c > bestCount) {
      best = v;
      bestCount = c;
    }
  }
  return best as SceneMood | undefined;
}

function moodFromMusicHint(hint: string | null | undefined): SceneMood | undefined {
  if (!hint?.trim()) return undefined;
  const lower = hint.toLowerCase();
  for (const { re, mood } of MUSIC_MOOD_KEYWORDS) {
    if (re.test(lower)) return mood;
  }
  return undefined;
}

/** Pick the best bundled track from scene mood / musicMood hints. */
export function pickBundledTrackForScenes(
  scenes: Array<{ mood?: string | null; musicMood?: string | null }>,
): MusicTrack {
  const fromHints = scenes
    .map((s) => moodFromMusicHint(s.musicMood))
    .filter(Boolean) as SceneMood[];
  const dominantHint = mostCommonMood(fromHints);
  const dominantScene = mostCommonMood(scenes.map((s) => s.mood));
  return (
    suggestBundledTrack(dominantHint) ??
    suggestBundledTrack(dominantScene) ??
    MUSIC_LIBRARY[0]
  );
}

export type AutoAttachMusicResult =
  | { attached: true; musicUrl: string; trackId: string }
  | { attached: false; reason: "already_set" | "not_found" };

/**
 * Attach a bundled BGM track when the script has no musicUrl yet.
 * Pass force=true to replace (Regenerate soundtrack).
 */
export async function autoAttachBundledMusic(
  scriptId: string,
  opts?: { force?: boolean },
): Promise<AutoAttachMusicResult> {
  const script = await getScript(scriptId);
  if (!script) return { attached: false, reason: "not_found" };
  if (script.musicUrl && !opts?.force) {
    return { attached: false, reason: "already_set" };
  }

  const track = pickBundledTrackForScenes(script.scenes);
  await updateScript(scriptId, { musicUrl: track.url });
  return { attached: true, musicUrl: track.url, trackId: track.id };
}
