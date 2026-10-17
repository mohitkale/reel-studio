import { z } from "zod";

/** Editorial intent only. Geometry, facts and narration stay in existing scene contracts. */
export const chapterDirectionSchema = z
  .object({
    goal: z.string().trim().min(3).max(500),
    phase: z.enum(["develop", "example", "recap"]),
    callbackChapterId: z.string().min(1).max(160).optional(),
  })
  .strict()
  .refine(
    (direction) =>
      direction.phase !== "recap" || Boolean(direction.callbackChapterId),
    { message: "A recap must reference an earlier chapter." },
  );
export type ChapterDirection = z.infer<typeof chapterDirectionSchema>;
export const longFormPolicySchema = z
  .object({
    version: z.literal("1.0.0"),
    targetSeconds: z.number().int().min(180).max(600),
  })
  .strict();
export type LongFormPolicy = z.infer<typeof longFormPolicySchema>;

export const LONG_FORM_BUDGETS = {
  seconds: 600,
  scenes: 240,
  chapters: 12,
  scenesPerCall: 20,
  globalContextCharacters: 6000,
  subjectContextCharacters: 2000,
  sectionSeconds: 30,
  compiledHtmlBytes: 16 * 1024 * 1024,
} as const;

export interface ChapterWritingDirection {
  goal: string;
  phase: ChapterDirection["phase"];
  targetSeconds?: number;
}

/** Stable IDs make a deliberate return explicit, without inventing a relationship. */
export function chapterDirectionIssue(
  chapters: readonly { id: string; direction?: ChapterDirection }[],
) {
  for (const [index, chapter] of chapters.entries()) {
    if (chapter.direction) {
      const parsed = chapterDirectionSchema.safeParse(chapter.direction);
      if (!parsed.success) return parsed.error.issues[0].message;
    }
    const callback = chapter.direction?.callbackChapterId;
    if (
      callback &&
      !chapters.slice(0, index).some((prior) => prior.id === callback)
    )
      return "Callbacks must reference an earlier chapter in this film.";
  }
}

export function lessonDirections(
  chapters: readonly { id: string; title: string; brief?: string }[],
): ChapterDirection[] {
  return chapters.map((chapter, index) => ({
    goal: (chapter.brief ?? `Explain ${chapter.title}`).slice(0, 500),
    phase:
      index === chapters.length - 1 && index > 0
        ? "recap"
        : index % 2
          ? "example"
          : "develop",
    ...(index === chapters.length - 1 && index > 0
      ? { callbackChapterId: chapters[0].id }
      : {}),
  }));
}

/** A bounded compiled document is an application limit, not a hardware guarantee. */
export function assertLessonHtmlBudget(bytes: number) {
  if (
    !Number.isInteger(bytes) ||
    bytes < 1 ||
    bytes > LONG_FORM_BUDGETS.compiledHtmlBytes
  )
    throw new Error(
      "Lesson composition exceeds the 16 MiB HTML budget. Split the film or simplify its visual inputs.",
    );
}
