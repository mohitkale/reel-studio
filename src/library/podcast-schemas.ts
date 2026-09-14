import { z } from "zod";

/** Zod schemas for podcast domain (DB columns + API + AI/JSON import). */

export const PODCAST_LENGTHS = ["short", "long"] as const;
export type PodcastLength = (typeof PODCAST_LENGTHS)[number];

export const PODCAST_GENDERS = ["male", "female", "neutral"] as const;
export type PodcastGender = (typeof PODCAST_GENDERS)[number];

export const podcastLengthSchema = z.enum(PODCAST_LENGTHS);
export const podcastGenderSchema = z.enum(PODCAST_GENDERS);
export const PODCAST_BUMPER_SECONDS = 6;

export const podcastPronunciationSchema = z.object({
  find: z.string().trim().min(1).max(80),
  replaceWith: z.string().trim().min(1).max(120),
  caseSensitive: z.boolean().default(false),
});

export const podcastPronunciationsSchema = z
  .array(podcastPronunciationSchema)
  .max(50)
  .superRefine((rules, ctx) => {
    const seen = new Set<string>();
    rules.forEach((rule, index) => {
      const key = rule.caseSensitive
        ? rule.find
        : rule.find.toLocaleLowerCase();
      if (seen.has(key)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Pronunciation find values must be unique",
          path: [index, "find"],
        });
      }
      seen.add(key);
    });
  });

export const podcastPauseSecondsSchema = z.number().min(0).max(10).nullable();

export const podcastFinishingSnapshotSchema = z.object({
  version: z.literal(1),
  intro: z
    .object({
      assetId: z.string().min(1),
      name: z.string().min(1),
      durationSeconds: z.number().positive(),
    })
    .nullable(),
  outro: z
    .object({
      assetId: z.string().min(1),
      name: z.string().min(1),
      durationSeconds: z.number().positive(),
    })
    .nullable(),
  pronunciations: podcastPronunciationsSchema,
  pauses: z.array(
    z.object({
      turnId: z.string().min(1),
      seconds: z.number().min(0).max(10),
    }),
  ),
});

export const podcastBeatTimingSchema = z.object({
  turnId: z.string(),
  startFrame: z.number().int().nonnegative(),
  durationFrames: z.number().int().nonnegative(),
  text: z.string(),
  characterKey: z.string().optional(),
});

export const podcastTimelineSchema = z.array(podcastBeatTimingSchema);

export const podcastChapterSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1).max(120),
  startFrame: z.number().int().nonnegative(),
  endFrame: z.number().int().positive(),
  startTurnId: z.string().min(1),
  endTurnId: z.string().min(1),
});

export const podcastChaptersSchema = z.array(podcastChapterSchema);

/** Snapshot of a cast voice used when a take was generated. */
export const podcastTakeVoiceSchema = z.object({
  key: z.string(),
  name: z.string(),
  providerId: z.string(),
  voiceId: z.string(),
  modelId: z.string().nullable().optional(),
});

export const podcastTakeVoicesSchema = z.array(podcastTakeVoiceSchema);

export type PodcastTakeVoice = z.infer<typeof podcastTakeVoiceSchema>;
export type PodcastPronunciation = z.infer<typeof podcastPronunciationSchema>;
export type PodcastFinishingSnapshot = z.infer<
  typeof podcastFinishingSnapshotSchema
>;

/** Character shape in AI/JSON scripts (id maps to PodcastCharacter.key). */
export const podcastScriptCharacterSchema = z.object({
  id: z.string().trim().min(1).max(40),
  name: z.string().trim().min(1).max(80),
  gender: podcastGenderSchema.optional().catch("neutral"),
});

export const podcastScriptTurnSchema = z.object({
  characterId: z.string().trim().min(1).max(40),
  text: z.string().trim().min(1).max(4000),
});

/**
 * Full podcast script plan from AI or external JSON paste.
 * Characters in the payload should match Setup keys when importing turns.
 */
export const podcastPlanSchema = z
  .object({
    title: z.string().trim().min(1).max(120).optional(),
    description: z.string().trim().max(2000).optional(),
    characters: z.array(podcastScriptCharacterSchema).min(1).max(4),
    turns: z.array(podcastScriptTurnSchema).min(2).max(120),
  })
  .superRefine((plan, ctx) => {
    const keys = new Set(plan.characters.map((c) => c.id));
    if (keys.size !== plan.characters.length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Character ids must be unique",
        path: ["characters"],
      });
    }
    for (let i = 0; i < plan.turns.length; i++) {
      if (!keys.has(plan.turns[i].characterId)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Turn ${i + 1}: unknown characterId "${plan.turns[i].characterId}"`,
          path: ["turns", i, "characterId"],
        });
      }
    }
  });

export type PodcastPlan = z.infer<typeof podcastPlanSchema>;
export type PodcastScriptCharacter = z.infer<
  typeof podcastScriptCharacterSchema
>;
export type PodcastScriptTurn = z.infer<typeof podcastScriptTurnSchema>;
export type PodcastBeatTiming = z.infer<typeof podcastBeatTimingSchema>;
