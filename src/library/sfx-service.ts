import type { ScriptSfxState } from "@/lib/sfx-library";
import { buildAutomaticSfxCues } from "@/lib/sfx-planner";
import { parseSfxState } from "@/lib/sfx-cues";
import { getScript, updateScript } from "@/library/repositories/scripts";

export { buildAutomaticSfxCues, buildTemplateSfxCues } from "@/lib/sfx-planner";
export { parseSfxState, resolveReelSfxCues } from "@/lib/sfx-cues";

export type EnsureSfxResult =
  | { attached: true; cueCount: number }
  | { attached: false; reason: "already_set" | "disabled" | "not_found" };

/**
 * Attach scene-aware cues when none exist yet. A forced refresh replaces only
 * automatic suggestions, preserving manual, legacy and locked cues.
 */
export async function ensureSfxCues(
  scriptId: string,
  opts?: { force?: boolean; enabled?: boolean },
): Promise<EnsureSfxResult> {
  const script = await getScript(scriptId);
  if (!script) return { attached: false, reason: "not_found" };

  const existing = parseSfxState(script.sfxJson);
  const enabled = opts?.enabled ?? (script.sfxEnabled && existing.enabled);
  if (!enabled && opts?.enabled !== true) {
    return { attached: false, reason: "disabled" };
  }

  if (existing.cues.length > 0 && !opts?.force) {
    return { attached: false, reason: "already_set" };
  }

  const preserved = existing.cues.filter(
    (cue) => cue.source !== "automatic" || cue.locked,
  );
  const protectedScenes = new Set(preserved.map((cue) => cue.sceneId));
  const cues = [
    ...preserved,
    ...buildAutomaticSfxCues(script.scenes, script.hideText).filter(
      (cue) => !protectedScenes.has(cue.sceneId),
    ),
  ];
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
