import { z } from "zod";
import { chapterPlanIssue, type ChapterPlan } from "./chapters";

export const chapterDraftSchema = z
  .object({
    version: z.literal("1.0.0"),
    topic: z.string().trim().min(3).max(4000),
    chapters: z
      .array(
        z
          .object({
            id: z.string().min(1).max(160),
            title: z.string().trim().min(1).max(120),
            brief: z.string().trim().min(3).max(2000),
            sceneCount: z.number().int().min(1).max(20),
          })
          .strict(),
      )
      .min(1)
      .max(12),
  })
  .strict()
  .refine(
    (draft) =>
      new Set(draft.chapters.map((chapter) => chapter.id)).size ===
      draft.chapters.length,
    {
      message: "Draft chapter IDs must be unique.",
    },
  );
export type ChapterDraft = z.infer<typeof chapterDraftSchema>;
export const chapterDraftEditSchema = z
  .object({
    expected: chapterDraftSchema.nullable(),
    draft: chapterDraftSchema.nullable(),
  })
  .strict();

/** Planned chapters use the same outline capacity as the future storyboard. */
export function chapterDraftCapacityIssue(
  script: { scenes: readonly { id: string }[]; chapterPlan?: ChapterPlan },
  counts: readonly number[],
): string | undefined {
  if (script.chapterPlan) {
    const issue = chapterPlanIssue(
      script.chapterPlan,
      script.scenes.map((scene) => scene.id),
    );
    if (issue) return `Update the chapter outline: ${issue}`;
  } else if (script.scenes.length > 20) {
    return "Save a valid chapter outline before planning more chapters.";
  }
  const existingCount =
    script.chapterPlan?.chapters.length ?? (script.scenes.length ? 1 : 0);
  if (!counts.length || counts.length + existingCount > 12)
    return "Keep the saved and planned chapters within 12 chapters.";
  if (
    counts.some((count) => !Number.isInteger(count) || count < 1 || count > 20)
  )
    return "Plan 1–20 scenes per chapter.";
  if (
    script.scenes.length + counts.reduce((sum, count) => sum + count, 0) >
    240
  )
    return "Keep the saved and planned scenes within 240 scenes.";
}
