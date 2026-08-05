import {
  defaultSfxForTemplate,
  type ScriptSfxState,
  type SfxCue,
} from "@/lib/sfx-library";
import { parseSfxState } from "@/lib/sfx-cues";
import { getScript, updateScript } from "@/library/repositories/scripts";

export { parseSfxState, resolveReelSfxCues } from "@/lib/sfx-cues";

/**
 * Sparse, under-the-VO cue map.
 * One tasteful accent per scene max — stacking toy clicks reads amateur.
 */
export function buildTemplateSfxCues(
  scenes: Array<{ id: string; templateId: string }>,
): SfxCue[] {
  const cues: SfxCue[] = [];
  for (const scene of scenes) {
    const sfxId = defaultSfxForTemplate(scene.templateId);
    if (!sfxId) continue;

    // Quiet bed under narration. Risers even quieter.
    const volume =
      sfxId === "riser" ? 0.14 : sfxId === "click" ? 0.1 : 0.16;

    cues.push({
      sceneId: scene.id,
      sfxId,
      // Land just after the visual punch, not on the first VO syllable.
      offsetSeconds: sfxId === "whoosh" || sfxId === "swipe" ? 0.02 : 0.12,
      volume,
    });
  }
  return cues;
}

export type EnsureSfxResult =
  | { attached: true; cueCount: number }
  | { attached: false; reason: "already_set" | "disabled" | "not_found" };

/**
 * Attach template-based SFX cues when none exist yet.
 * force=true regenerates cues (keeps sfxEnabled unless explicitly turned off).
 */
export async function ensureSfxCues(
  scriptId: string,
  opts?: { force?: boolean; enabled?: boolean },
): Promise<EnsureSfxResult> {
  const script = await getScript(scriptId);
  if (!script) return { attached: false, reason: "not_found" };

  const existing = parseSfxState(script.sfxJson);
  const enabled = opts?.enabled ?? script.sfxEnabled ?? existing.enabled;
  if (!enabled && opts?.enabled !== true) {
    return { attached: false, reason: "disabled" };
  }

  if (existing.cues.length > 0 && !opts?.force) {
    return { attached: false, reason: "already_set" };
  }

  const cues = buildTemplateSfxCues(script.scenes);
  const state: ScriptSfxState = { enabled: true, cues };
  await updateScript(scriptId, {
    sfxEnabled: true,
    sfxJson: JSON.stringify(state),
  });
  return { attached: true, cueCount: cues.length };
}

export async function setSfxEnabled(
  scriptId: string,
  enabled: boolean,
): Promise<void> {
  const script = await getScript(scriptId);
  if (!script) return;
  const state = parseSfxState(script.sfxJson);
  state.enabled = enabled;
  await updateScript(scriptId, {
    sfxEnabled: enabled,
    sfxJson: JSON.stringify(state),
  });
}
