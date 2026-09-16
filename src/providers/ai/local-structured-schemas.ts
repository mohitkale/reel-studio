import { z } from "zod";

import { productionChartDataSchema } from "@/production/spec";
import {
  planEffectSchema,
  planEnergySchema,
  planStyleIdSchema,
  sceneMoodSchema,
} from "./types";
import { templateIdForCapabilityId } from "@/engines/capabilities";
import { podcastAiCharacterSchema, podcastAiTurnSchema } from "./podcast-types";

const strictSceneSchema = z
  .object({
    text: z.string().min(1),
    spokenText: z.string().optional(),
    capabilityId: z
      .string()
      .refine((value) => Boolean(templateIdForCapabilityId(value))),
    emphasis: z.array(z.string()),
    visual: z.string().max(64).optional(),
    items: z.array(z.string().trim().min(1).max(80)).min(2).max(5).optional(),
    chart: productionChartDataSchema.optional(),
    backgroundQuery: z.string().trim().min(2).max(80).optional(),
    mediaKind: z.enum(["image", "video"]).optional(),
    effect: planEffectSchema.optional(),
    mood: sceneMoodSchema.optional(),
    musicMood: z.string().trim().max(60).optional(),
  })
  .strict();

export const strictLocalScenePlanSchema = z
  .object({
    projectName: z.string().min(1),
    scriptName: z.string().min(1),
    voiceStyle: z.string().optional(),
    styleId: planStyleIdSchema,
    energy: planEnergySchema,
    scenes: z.array(strictSceneSchema).min(1).max(20),
  })
  .strict();

export const strictLocalPodcastPlanSchema = z
  .object({
    title: z.string().trim().min(1).max(120).optional(),
    description: z.string().trim().max(2000).optional(),
    characters: z.array(podcastAiCharacterSchema.strict()).min(1).max(4),
    turns: z.array(podcastAiTurnSchema.strict()).min(2).max(120),
  })
  .strict();

export const strictLocalClipSuggestionsSchema = z
  .object({
    suggestions: z
      .array(
        z
          .object({
            startTurnId: z.string().min(1),
            endTurnId: z.string().min(1),
            label: z.string().min(1),
            reason: z.string().min(1),
          })
          .strict(),
      )
      .min(1)
      .max(5),
  })
  .strict();
