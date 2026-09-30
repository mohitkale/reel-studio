import type { ScriptSfxState } from "@/lib/sfx-library";
import { buildAutomaticSfxCues } from "@/lib/sfx-planner";
import { parseSfxState } from "@/lib/sfx-cues";
import { prisma } from "@/library/db";
import { toSceneDTO } from "@/library/repositories/map";

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
  return prisma.$transaction(async (tx) => {
    const script = await tx.script.findUnique({
      where: { id: scriptId },
      include: { scenes: { orderBy: { order: "asc" } } },
    });
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
      ...buildAutomaticSfxCues(
        script.scenes.map(toSceneDTO),
        script.hideText,
      ).filter((cue) => !protectedScenes.has(cue.sceneId)),
    ];
    const state: ScriptSfxState = { enabled: true, cues };
    await tx.script.update({
      where: { id: scriptId },
      data: {
        sfxEnabled: true,
        sfxJson: JSON.stringify(state),
      },
    });
    return { attached: true, cueCount: cues.length };
  });
}

export async function setSfxEnabled(
  scriptId: string,
  enabled: boolean,
): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const script = await tx.script.findUnique({ where: { id: scriptId } });
    if (!script) return;
    const state = parseSfxState(script.sfxJson);
    state.enabled = enabled;
    await tx.script.update({
      where: { id: scriptId },
      data: {
        sfxEnabled: enabled,
        sfxJson: JSON.stringify(state),
      },
    });
  });
}
