import { z } from "zod";
import { subjectRegistrySchema } from "@/video/sequence-direction";
const artifact = z
  .object({
    assetId: z.string().min(1).max(160),
    startSeconds: z.number().finite().min(0).max(3600).default(0),
  })
  .strict();
export const proofFeatureInputSchema = z
  .object({
    id: z.string().min(1).max(160),
    label: z.string().trim().min(2).max(160),
    subjectLabel: z.string().trim().min(2).max(96),
    sceneIds: z.array(z.string().min(1).max(160)).min(1).max(240),
    assets: z.array(artifact).max(10),
  })
  .strict();
export const proofFeatureSchema = proofFeatureInputSchema.extend({
  subjectId: z.string().min(1).max(100),
});
export const productProofSchema = z
  .object({
    version: z.literal(1),
    revision: z.number().int().positive(),
    features: z.array(proofFeatureSchema).max(50),
    subjects: subjectRegistrySchema,
  })
  .strict();
export type ProductProof = z.infer<typeof productProofSchema>;
export const sceneProofSchema = z
  .object({
    featureId: z.string().min(1).max(160),
    subjectId: z.string().min(1).max(100),
    assetId: z.string().min(1).max(160).optional(),
    sourceUrl: z.string().min(1).max(2048).optional(),
    sourceStatus: z.enum(["supplied_unverified", "missing"]),
    note: z.string().max(500),
  })
  .strict();
export const productProofControlSchema = z.discriminatedUnion("action", [
  z
    .object({
      action: z.literal("save"),
      expectedHash: z.string().length(64),
      features: z.array(proofFeatureInputSchema).max(50),
    })
    .strict()
    .superRefine((input, ctx) => {
      if (
        new Set(input.features.map((f) => f.id)).size !== input.features.length
      )
        ctx.addIssue({ code: "custom", message: "Feature IDs must be unique" });
      for (const feature of input.features)
        if (
          new Set(feature.sceneIds).size !== feature.sceneIds.length ||
          new Set(feature.assets.map((a) => a.assetId)).size !==
            feature.assets.length
        )
          ctx.addIssue({
            code: "custom",
            message: "A feature must use distinct scenes/artifacts",
          });
      if (input.features.reduce((sum, f) => sum + f.sceneIds.length, 0) > 1000)
        ctx.addIssue({
          code: "custom",
          message: "Proof mappings exceed their size limit",
        });
    }),
  z
    .object({
      action: z.enum(["preview", "apply"]),
      expectedHash: z.string().length(64),
      featureId: z.string().min(1).max(160),
      assetId: z.string().min(1).max(160).optional(),
    })
    .strict(),
]);
export type ProductProofControl = z.infer<typeof productProofControlSchema>;
export interface ProductProofPreview {
  state: "preview" | "applied";
  sourceHash: string;
  featureId: string;
  assetId?: string;
  subjectId: string;
  startSeconds: number;
  changes: Array<{
    sceneId: string;
    text: string;
    narration: string;
    beforeAssetIds: string[];
    afterAssetIds: string[];
    reason: string;
    readingSeconds: number;
  }>;
  warnings: string[];
}
