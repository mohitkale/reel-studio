import { z } from "zod";
import type { ReelBeat } from "@/compositions/types";

export const chapterPlanSchema = z
  .object({
    version: z.literal("1.0.0"),
    chapters: z
      .array(
        z
          .object({
            id: z.string().min(1).max(160),
            title: z.string().trim().min(1).max(120),
            firstSceneId: z.string().min(1).max(160),
          })
          .strict(),
      )
      .min(1)
      .max(12),
  })
  .strict()
  .refine(
    (plan) =>
      new Set(plan.chapters.map((chapter) => chapter.id)).size ===
      plan.chapters.length,
    { message: "Chapter IDs must be unique." },
  );
export type ChapterPlan = z.infer<typeof chapterPlanSchema>;
/** Creation has scene positions; persist boundaries only after IDs are assigned. */
export function chapterPlanFromStarts(
  starts: readonly { title: string; firstSceneIndex: number }[],
  sceneIds: readonly string[],
): ChapterPlan {
  const plan = chapterPlanSchema.parse({
    version: "1.0.0",
    chapters: starts.map((chapter, index) => ({
      id: `chapter:${index + 1}`,
      title: chapter.title,
      firstSceneId: Number.isInteger(chapter.firstSceneIndex)
        ? sceneIds[chapter.firstSceneIndex]
        : undefined,
    })),
  });
  const issue = chapterPlanIssue(plan, sceneIds);
  if (issue) throw new Error(issue);
  return plan;
}
export const chapterEditSchema = z
  .object({
    expected: chapterPlanSchema.nullable(),
    expectedSceneIds: z.array(z.string().min(1).max(160)).min(1).max(240),
    plan: chapterPlanSchema,
  })
  .strict();
export type ChapterEdit = z.infer<typeof chapterEditSchema>;

export function chapterPlanIssue(
  plan: ChapterPlan,
  orderedSceneIds: readonly string[],
): string | undefined {
  if (!orderedSceneIds.length || orderedSceneIds.length > 240)
    return "Chapter planning supports 1–240 scenes.";
  const positions = plan.chapters.map((chapter) =>
    orderedSceneIds.indexOf(chapter.firstSceneId),
  );
  if (positions[0] !== 0)
    return "The first chapter must begin with the first scene.";
  if (
    positions.some(
      (position, index) =>
        position < 0 || (index > 0 && position <= positions[index - 1]),
    )
  )
    return "Chapter starts must follow scene order, with each scene used once.";
  if (
    positions.some(
      (position, index) =>
        (positions[index + 1] ?? orderedSceneIds.length) - position > 20,
    )
  )
    return "Keep each chapter within 20 scenes; add another chapter boundary.";
}

/** Suggest bounded chapters without rewriting, summarizing or retiming content. */
export function proposeChapterPlan(
  scenes: readonly { id: string; text: string }[],
  timeline: readonly ReelBeat[],
  fps: number,
): ChapterPlan {
  if (
    !scenes.length ||
    scenes.length > 240 ||
    !Number.isFinite(fps) ||
    fps <= 0
  )
    throw new Error(
      "Chapter planning needs 1–240 scenes and a valid frame rate.",
    );
  const beats = new Map(timeline.map((beat) => [beat.sceneId, beat]));
  const chapters: ChapterPlan["chapters"] = [];
  let count = 0,
    duration = 0;
  scenes.forEach((scene) => {
    const seconds = Math.max(
      0,
      (beats.get(scene.id)?.durationFrames ?? 0) / fps,
    );
    if (!count || count >= 20 || (duration >= 45 && duration + seconds > 60)) {
      chapters.push({
        id: `chapter:${chapters.length + 1}`,
        title: `Chapter ${chapters.length + 1}`,
        firstSceneId: scene.id,
      });
      count = 0;
      duration = 0;
    }
    count++;
    duration += seconds;
  });
  if (chapters.length > 12)
    throw new Error(
      "This cut needs more than 12 bounded chapters. Divide it into separate videos.",
    );
  return chapterPlanSchema.parse({ version: "1.0.0", chapters });
}

export function resolveChapters(
  plan: ChapterPlan,
  orderedSceneIds: readonly string[],
  timeline: readonly ReelBeat[],
) {
  const issue = chapterPlanIssue(plan, orderedSceneIds);
  if (issue) return { issue, chapters: [] };
  const beats = new Map(timeline.map((beat) => [beat.sceneId, beat]));
  const chapters = plan.chapters.map((chapter, index) => {
    const start = orderedSceneIds.indexOf(chapter.firstSceneId);
    const end =
      index + 1 < plan.chapters.length
        ? orderedSceneIds.indexOf(plan.chapters[index + 1].firstSceneId)
        : orderedSceneIds.length;
    const sceneIds = orderedSceneIds.slice(start, end);
    const first = beats.get(sceneIds[0]);
    const last = beats.get(sceneIds[sceneIds.length - 1]);
    return {
      ...chapter,
      sceneIds,
      startFrame: first?.startFrame ?? 0,
      endFrame: last ? last.startFrame + last.durationFrames : 0,
    };
  });
  return { issue: undefined, chapters };
}
