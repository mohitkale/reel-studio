import { resolveSpokenText } from "@/lib/spoken-text";
import {
  getCachedBeatAudio,
  sceneSynthesisCacheKey,
  setCachedBeatWav,
} from "@/library/scene-audio-cache";
import type { QuickProduceOptions } from "@/production/quick-produce";

type NarratedScene = {
  id: string;
  text: string;
  spokenText?: string | null;
};

/** Seed the short's own cache so the worker can stitch it and synthesize any new lines. */
export async function reuseCutdownNarration(input: {
  source: NarratedScene[];
  target: { id: string; scenes: NarratedScene[] };
  sourceSceneIndices: Array<number | null>;
  voice: QuickProduceOptions["voice"];
}): Promise<void> {
  const { source, target, sourceSceneIndices, voice } = input;
  if (!voice.enabled) return;

  for (const [index, scene] of target.scenes.entries()) {
    const sourceIndex = sourceSceneIndices[index];
    const original = sourceIndex == null ? undefined : source[sourceIndex];
    const spoken = resolveSpokenText(scene);
    if (!original || resolveSpokenText(original) !== spoken) continue;

    const key = sceneSynthesisCacheKey(
      original.id,
      spoken,
      voice,
      voice.paces?.[index],
    );
    const audio = await getCachedBeatAudio(key);
    if (audio) {
      await setCachedBeatWav(
        { ...key, sceneId: scene.id, scriptId: target.id },
        audio.wav,
        audio.words,
      );
    }
  }
}
