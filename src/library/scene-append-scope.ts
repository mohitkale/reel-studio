import type { ScriptDTO } from "@/lib/dto";
import { chapterPlanIssue } from "@/production/chapters";
import { AIError } from "@/providers/ai/types";

/** Validate capacity before spending a bounded provider call. */
export function prepareSceneAppendScope(
  script: Pick<ScriptDTO, "chapterPlan"> & {
    scenes: Pick<ScriptDTO["scenes"][number], "id" | "text" | "spokenText">[];
  },
  input: { chapterTitle?: string; sceneCount?: number },
) {
  const plan = script.chapterPlan;
  const ids = script.scenes.map((scene) => scene.id);
  // The existing automatic append prompt asks for 3–5 scenes.
  const count = input.sceneCount ?? 5;
  if (!Number.isInteger(count) || count < 1 || count > 20)
    throw new AIError("Add 1–20 scenes per generation.", 400);
  if (input.chapterTitle !== undefined && !plan)
    throw new AIError(
      "Save a chapter outline before adding a named chapter.",
      400,
    );
  if (plan) {
    const issue = chapterPlanIssue(plan, ids);
    if (issue) throw new AIError(`Update the chapter outline: ${issue}`, 400);
    if (ids.length + count > 240)
      throw new AIError(
        "Chapter planning supports up to 240 scenes. Choose fewer new scenes or start another video.",
        400,
      );
    if (input.chapterTitle !== undefined) {
      if (!input.chapterTitle.trim() || input.chapterTitle.trim().length > 120)
        throw new AIError("Use a chapter title of 1–120 characters.", 400);
      if (plan.chapters.length >= 12)
        throw new AIError(
          "This video already has 12 chapters. Start another video.",
          400,
        );
    } else {
      const lastStart = ids.indexOf(plan.chapters.at(-1)!.firstSceneId);
      if (ids.length - lastStart + count > 20)
        throw new AIError(
          "The last chapter would exceed 20 scenes. Name a new chapter or choose fewer new scenes.",
          400,
        );
    }
  }
  const context = [
    ...(plan
      ? [
          `Saved chapters (context only): ${JSON.stringify(plan.chapters.map((chapter) => chapter.title))}`,
        ]
      : []),
    ...script.scenes.slice(-2).map((scene, index, neighbors) => {
      const position = ids.length - neighbors.length + index + 1;
      // Bounded excerpts even when earlier chapters have long narration.
      return `Context only (do not replace): Scene ${position}: ${scene.text.slice(0, 500)} | voice: ${(scene.spokenText ?? scene.text).slice(0, 500)}`;
    }),
  ].join("\n");
  return { context };
}
