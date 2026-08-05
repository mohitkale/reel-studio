import { listTakes } from "@/library/repositories/takes";
import { getScript } from "@/library/repositories/scripts";
import { autoAttachBundledMusic } from "@/library/soundtrack-service";
import { ensureSfxCues, parseSfxState } from "@/library/sfx-service";

export type ProduceStep = "soundtrack" | "sfx" | "voice" | "ready";

export interface ProduceReelAudioResult {
  scriptId: string;
  steps: ProduceStep[];
  musicAttached: boolean;
  sfxAttached: boolean;
  /** True when the client/route should start a VO job. */
  needsVoice: boolean;
  hadVoiceAlready: boolean;
}

/**
 * Fill BGM + SFX if missing. Voice is started by the API route (same job queue
 * pattern as /takes) so `after()` can keep long synthesis alive.
 */
export async function produceReelAudio(
  scriptId: string,
): Promise<ProduceReelAudioResult> {
  const script = await getScript(scriptId);
  if (!script) throw new Error("Script not found");

  const steps: ProduceStep[] = [];

  const music = await autoAttachBundledMusic(scriptId);
  if (music.attached) steps.push("soundtrack");

  const sfxState = parseSfxState(script.sfxJson);
  const sfx =
    script.sfxEnabled === false
      ? { attached: false as const, reason: "disabled" as const }
      : await ensureSfxCues(scriptId, {
          force: sfxState.cues.length === 0,
        });
  if (sfx.attached) steps.push("sfx");

  const takes = await listTakes(scriptId);
  const hadVoiceAlready = takes.length > 0;
  const needsVoice = !hadVoiceAlready;

  if (!needsVoice) steps.push("ready");
  else steps.push("voice");

  return {
    scriptId,
    steps,
    musicAttached: music.attached,
    sfxAttached: Boolean(sfx.attached),
    needsVoice,
    hadVoiceAlready,
  };
}
