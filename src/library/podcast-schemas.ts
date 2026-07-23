import { z } from "zod";

/** Zod schemas for podcast domain (DB columns + API + AI/JSON import). */

export const PODCAST_LENGTHS = ["short", "long"] as const;
export type PodcastLength = (typeof PODCAST_LENGTHS)[number];

export const PODCAST_GENDERS = ["male", "female", "neutral"] as const;
export type PodcastGender = (typeof PODCAST_GENDERS)[number];

export const podcastLengthSchema = z.enum(PODCAST_LENGTHS);
export const podcastGenderSchema = z.enum(PODCAST_GENDERS);

export const podcastBeatTimingSchema = z.object({
  turnId: z.string(),
  startFrame: z.number().int().nonnegative(),
  durationFrames: z.number().int().nonnegative(),
  text: z.string(),
  characterKey: z.string().optional(),
});

export const podcastTimelineSchema = z.array(podcastBeatTimingSchema);

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
    characters: z.array(podcastScriptCharacterSchema).min(2).max(4),
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
export type PodcastScriptCharacter = z.infer<typeof podcastScriptCharacterSchema>;
export type PodcastScriptTurn = z.infer<typeof podcastScriptTurnSchema>;
export type PodcastBeatTiming = z.infer<typeof podcastBeatTimingSchema>;
