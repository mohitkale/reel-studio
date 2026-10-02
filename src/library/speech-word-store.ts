import { speechWordsSchema, type SpeechWord } from "@/lib/speech-words";
import { getAssetStore, type AssetStore } from "@/library/storage";
export async function readSpeechWords(
  key: string,
  store: AssetStore = getAssetStore(),
): Promise<SpeechWord[] | undefined> {
  try {
    return speechWordsSchema.parse(
      JSON.parse((await store.get(`${key}.words.json`)).toString("utf8")),
    );
  } catch {
    return undefined;
  } // Older cache entries have no measured words.
}
export async function writeSpeechWords(
  key: string,
  words?: SpeechWord[],
  store: AssetStore = getAssetStore(),
) {
  if (words?.length)
    await store.put(
      `${key}.words.json`,
      Buffer.from(JSON.stringify(speechWordsSchema.parse(words))),
    );
}
