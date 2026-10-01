import { getScript } from "@/library/repositories/scripts";
import { verifyMusicMapSource } from "@/library/music-map-service";
import { ProviderError } from "@/providers/voice/types";
import {
  suggestNarrationCuts,
  type cutSuggestionRequestSchema,
} from "@/production/cut-suggestions";
import type { z } from "zod";

export async function proposeNarrationCuts(
  scriptId: string,
  input: z.infer<typeof cutSuggestionRequestSchema>,
  baseUrl: string,
) {
  const script = await getScript(scriptId);
  if (!script) throw new ProviderError("Script not found", 404);
  if (
    JSON.stringify(script.musicMap) !==
      JSON.stringify(input.expectedMusicMap) ||
    script.musicUrl !== input.expectedMusicMap.sourceUrl
  )
    throw new ProviderError(
      "Music changed. Reload and review the current map.",
      409,
    );
  await verifyMusicMapSource(input.expectedMusicMap, baseUrl);
  const take = script.takes.find((take) => take.id === input.takeId);
  if (!take)
    throw new ProviderError("Voice take does not belong to this script", 400);
  return suggestNarrationCuts(script, take);
}
