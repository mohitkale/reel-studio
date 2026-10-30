import { z } from "zod";
export const editorialRevisionKindSchema = z.enum([
  "make-specific",
  "shorten",
  "replace-visual",
  "change-direction",
]);
export const editorialRevisionPreviewSchema = z
  .object({
    action: z.literal("preview"),
    key: z.string().min(8).max(160),
    expectedHash: z.string().length(64),
    sceneId: z.string().min(1).max(160),
    kind: editorialRevisionKindSchema,
    detail: z.string().trim().max(4000).default(""),
    copy: z
      .object({
        screenCopy: z.string().trim().min(1).max(1000),
        narration: z.string().trim().min(1).max(4000),
      })
      .strict()
      .optional(),
    assetId: z.string().min(1).max(160).optional(),
    budget: z
      .object({ maxProviderCalls: z.union([z.literal(0), z.literal(1)]) })
      .strict(),
  })
  .strict()
  .superRefine((input, ctx) => {
    const copy = input.kind === "make-specific" || input.kind === "shorten";
    if (!copy && input.budget.maxProviderCalls)
      ctx.addIssue({
        code: "custom",
        message: "Visual revisions have a zero-call budget",
      });
    if (copy && !input.budget.maxProviderCalls && !input.copy)
      ctx.addIssue({
        code: "custom",
        message: "Supply replacement copy for a local revision",
      });
    if (input.kind === "make-specific" && !input.detail)
      ctx.addIssue({
        code: "custom",
        message: "Supply the concrete detail to use; never invent proof",
      });
    if (!copy && input.copy)
      ctx.addIssue({
        code: "custom",
        message: "Visual revisions cannot change copy",
      });
    if (input.kind !== "replace-visual" && input.assetId)
      ctx.addIssue({
        code: "custom",
        message: "Asset replacement is limited to replace-visual",
      });
  });
export const editorialReviewControlSchema = z.union([
  editorialRevisionPreviewSchema,
  z
    .object({
      action: z.enum(["apply", "undo", "cancel"]),
      proposalId: z.string().min(1).max(160),
      expectedHash: z.string().length(64),
    })
    .strict(),
]);
export type EditorialReviewControl = z.infer<
  typeof editorialReviewControlSchema
>;
export type EditorialRevisionPreview = z.infer<
  typeof editorialRevisionPreviewSchema
>;
export const editorialSceneSnapshotSchema = z
  .object({
    text: z.string(),
    spokenText: z.string().nullable(),
    templateId: z.string(),
    emphasis: z.string().nullable(),
    visual: z.string().nullable(),
    layoutJson: z.string().nullable(),
    hideText: z.boolean().nullable(),
    selectedVoiceClipId: z.string().nullable(),
    assetRefs: z.string().nullable(),
  })
  .strict();
const revisionStockSchema = z
  .object({
    providerId: z.string(),
    providerAssetId: z.string(),
    kind: z.string(),
    snapshotJson: z.string().max(200000),
    localAssetId: z.string().nullable(),
  })
  .strict();
export const editorialProposalSchema = z
  .object({
    id: z.string().min(1).max(160),
    fingerprint: z.string().length(64),
    deadlineAt: z.iso.datetime().optional(),
    sourceHash: z.string().length(64),
    appliedHash: z.string().length(64).optional(),
    sceneId: z.string().min(1).max(160),
    kind: editorialRevisionKindSchema,
    state: z.enum([
      "running",
      "ready",
      "failed",
      "canceled",
      "applied",
      "undone",
    ]),
    providerCalls: z.union([z.literal(0), z.literal(1)]),
    beforeStock: revisionStockSchema.nullable().optional(),
    before: editorialSceneSnapshotSchema,
    after: editorialSceneSnapshotSchema,
    error: z.string().max(1000).nullable(),
  })
  .strict();
export type EditorialProposal = z.infer<typeof editorialProposalSchema>;
export interface EditorialFinding {
  kind: "unsupported-claim" | "repetition" | "missing-payoff" | "filler";
  sceneId?: string;
  message: string;
}
