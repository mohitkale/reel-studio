import { z } from "zod";
import { scenePlanSchema } from "@/providers/ai/types";
import { productionSceneRoleSchema } from "./roles";
import { evidenceReferenceSchema } from "@/research/contracts";

export const editorialStoryboardSchema = z
  .object({
    version: z.literal(1),
    sourceRevision: z.number().int().positive(),
    inputHash: z.string().length(64),
    sourceHash: z.string().length(64),
    state: z.enum(["ready", "applied", "canceled"]),
    appliedHash: z.string().length(64).optional(),
    providerCalls: z.literal(0),
    plan: scenePlanSchema,
    roles: z.array(productionSceneRoleSchema).min(1).max(20),
    shots: z
      .array(
        z
          .object({
            beatId: z.string().min(1).max(160),
            sceneId: z.string().min(1).max(240),
            purpose: z.string().max(200),
            narration: z.string().max(4000),
            screenCopy: z.string().max(1000),
            assetNeeds: z.array(z.string().max(500)).max(10),
            explanation: z.string().max(1000),
            references: z.array(evidenceReferenceSchema).max(20),
          })
          .strict(),
      )
      .min(1)
      .max(20),
  })
  .strict();
export type EditorialStoryboard = z.infer<typeof editorialStoryboardSchema>;
export const storyboardControlSchema = z.discriminatedUnion("action", [
  z
    .object({
      action: z.literal("compile"),
      expectedRevision: z.number().int().positive(),
      budget: z.object({ maxProviderCalls: z.literal(0) }).strict(),
    })
    .strict(),
  z
    .object({ action: z.literal("apply"), expectedHash: z.string().length(64) })
    .strict(),
  z
    .object({
      action: z.literal("cancel"),
      expectedHash: z.string().length(64),
    })
    .strict(),
]);
export type StoryboardControl = z.infer<typeof storyboardControlSchema>;
