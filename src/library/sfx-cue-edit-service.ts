import { prisma } from "@/library/db";
import { toSceneDTO } from "@/library/repositories/map";
import { parseSfxState } from "@/lib/sfx-cues";
import { buildAutomaticSfxCues } from "@/lib/sfx-planner";
import {
  sfxCueEditRequestSchema,
  type SfxCueEditRequest,
} from "@/lib/sfx-cue-edit";

/** Optimistic cue identity plus a transaction protects concurrent creator edits. */
export async function editSfxCue(scriptId: string, input: SfxCueEditRequest) {
  const body = sfxCueEditRequestSchema.parse(input);
  return prisma.$transaction(async (tx) => {
    const script = await tx.script.findUnique({
      where: { id: scriptId },
      include: { scenes: true },
    });
    if (!script) return { state: "not_found" as const };
    const state = parseSfxState(script.sfxJson);
    const cue = state.cues[body.index];
    if (!cue || JSON.stringify(cue) !== JSON.stringify(body.expected))
      return { state: "conflict" as const };
    if (body.action === "edit") {
      if (
        body.changes?.offsetSeconds !== undefined &&
        (cue.event
          ? Math.abs(body.changes.offsetSeconds) > 2
          : body.changes.offsetSeconds < 0)
      )
        return { state: "invalid_timing" as const };
      state.cues[body.index] = {
        ...cue,
        ...body.changes,
        source: "manual",
        locked: true,
      };
    } else {
      state.cues = state.cues.filter(
        (candidate, index) =>
          index !== body.index &&
          !(
            candidate.sceneId === cue.sceneId &&
            candidate.source === "automatic" &&
            !candidate.locked
          ),
      );
      const scene = script.scenes.find((row) => row.id === cue.sceneId);
      if (
        scene &&
        !state.cues.some((candidate) => candidate.sceneId === cue.sceneId)
      ) {
        state.cues.splice(
          Math.min(body.index, state.cues.length),
          0,
          ...buildAutomaticSfxCues([toSceneDTO(scene)], script.hideText),
        );
      }
    }
    await tx.script.update({
      where: { id: scriptId },
      data: { sfxJson: JSON.stringify(state) },
    });
    return { state: "updated" as const };
  });
}
