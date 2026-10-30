import { z } from "zod";
import { AI_PROVIDER_IDS } from "@/providers/ai/types";
import { orientationSchema } from "@/lib/orientation";
import { evidenceReferenceSchema } from "@/research/contracts";

export const creativeBriefSchema = z
  .object({
    intent: z.enum(["product", "explainer", "news", "data", "brand"]),
    audience: z.string().trim().min(2).max(300),
    goal: z.string().trim().min(3).max(500),
    language: z.string().trim().min(2).max(80).default("English"),
    targetSeconds: z.number().int().min(15).max(180).default(45),
    tone: z.string().trim().min(2).max(160).default("Clear and conversational"),
    takeaway: z.string().trim().min(3).max(500),
  })
  .strict();
export type CreativeBrief = z.infer<typeof creativeBriefSchema>;
export const editorialReferenceSchema = evidenceReferenceSchema;
export const editorialScriptSchema = z
  .object({
    version: z.literal(1),
    title: z.string().trim().min(1).max(300),
    angle: z.string().trim().min(1).max(500),
    beats: z
      .array(
        z
          .object({
            id: z.string().min(1).max(160),
            purpose: z.string().min(1).max(200),
            headline: z.string().trim().min(1).max(1000),
            narration: z.string().trim().min(1).max(4000),
            references: z.array(editorialReferenceSchema).max(20),
            locked: z.boolean().default(false),
          })
          .strict(),
      )
      .min(1)
      .max(20),
    estimatedSeconds: z.number().finite().nonnegative(),
    gaps: z.array(z.string().max(2000)).max(100),
  })
  .strict()
  .superRefine((draft, ctx) => {
    if (new Set(draft.beats.map((beat) => beat.id)).size !== draft.beats.length)
      ctx.addIssue({
        code: "custom",
        message: "Editorial beat IDs must be unique",
      });
    if (
      draft.beats.reduce(
        (sum, beat) => sum + beat.narration.length + beat.headline.length,
        0,
      ) > 30_000
    )
      ctx.addIssue({
        code: "custom",
        message: "Editorial script exceeds its size limit",
      });
  });
export type EditorialScript = z.infer<typeof editorialScriptSchema>;
export const editorialCreationRequestSchema = z
  .object({
    idempotencyKey: z.string().trim().min(8).max(160),
    brief: z.string().trim().min(3).max(8000),
    creativeBrief: creativeBriefSchema,
    providerId: z.enum(AI_PROVIDER_IDS),
    modelId: z.string().trim().min(1).max(160).optional(),
    evidenceId: z.string().min(1).max(160).optional(),
    orientation: orientationSchema.default("portrait"),
    brandKitId: z.string().min(1).max(160).nullable().default(null),
    budget: z
      .object({
        maxProviderCalls: z.number().int().min(1).max(3),
        deadlineMs: z.number().int().min(1000).max(45_000).default(30_000),
      })
      .strict(),
  })
  .strict();
export type EditorialCreationRequest = z.infer<
  typeof editorialCreationRequestSchema
>;
export const editorialWorkflowSchema = z
  .object({
    version: z.literal(1),
    key: z.string().min(8).max(160),
    fingerprint: z.string().length(64),
    request: editorialCreationRequestSchema,
    state: z.enum(["queued", "running", "ready", "failed", "canceled"]),
    callsUsed: z.number().int().min(0).max(1),
    revisionCallsUsed: z.number().int().min(0).max(2).default(0),
    deadlineAt: z.iso.datetime(),
    revision: z.number().int().nonnegative(),
    draft: editorialScriptSchema.optional(),
    error: z.string().max(2000).nullable(),
  })
  .strict();
export type EditorialWorkflow = z.infer<typeof editorialWorkflowSchema>;

export const EDITORIAL_ARCS: Record<CreativeBrief["intent"], string[]> = {
  product: [
    "User problem",
    "Supplied product mechanism",
    "Available proof and its limits",
    "Practical next step",
  ],
  explainer: [
    "Specific question",
    "How it works",
    "Supported example",
    "Useful takeaway",
  ],
  news: [
    "What happened and when",
    "Source and context",
    "What is uncertain",
    "What to watch next",
  ],
  data: [
    "Question and dataset",
    "Exact comparison",
    "Interpretation with limits",
    "Evidence-bound takeaway",
  ],
  brand: [
    "Brand purpose",
    "Concrete supplied detail",
    "Supported value",
    "Invitation aligned with the goal",
  ],
};

export const editorialControlSchema = z.discriminatedUnion("action", [
  z
    .object({
      action: z.literal("save"),
      expectedRevision: z.number().int().positive(),
      draft: editorialScriptSchema,
    })
    .strict(),
  z.object({ action: z.literal("cancel") }).strict(),
  z.object({ action: z.literal("resume") }).strict(),
]);
export type EditorialControl = z.infer<typeof editorialControlSchema>;
