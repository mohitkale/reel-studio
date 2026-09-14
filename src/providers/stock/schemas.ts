import { z } from "zod";

import { orientationSchema } from "@/lib/orientation";

export const stockProviderIdSchema = z
  .string()
  .trim()
  .min(1)
  .max(64)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);

const providerAssetIdSchema = z.string().trim().min(1).max(2048);

const externalHttpsUrlSchema = z
  .string()
  .trim()
  .min(1)
  .max(2048)
  .url()
  .superRefine((value, ctx) => {
    const url = new URL(value);
    if (url.protocol !== "https:") {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Stock provider URLs must use HTTPS",
      });
    }
    if (url.username || url.password) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Stock provider URLs must not contain credentials",
      });
    }
  });

export const stockMediaKindSchema = z.enum(["image", "video"]);
export type StockMediaKind = z.infer<typeof stockMediaKindSchema>;

export const stockMediaAcquisitionPolicySchema = z.enum([
  "hotlink",
  "download",
  "download-preferred",
]);
export type StockMediaAcquisitionPolicy = z.infer<
  typeof stockMediaAcquisitionPolicySchema
>;

export const stockMediaAttributionSchema = z
  .object({
    text: z.string().trim().min(1).max(500),
    required: z.boolean(),
    licenseName: z.string().trim().min(1).max(120).optional(),
    licenseUrl: externalHttpsUrlSchema.optional(),
  })
  .strict();
export type StockMediaAttribution = z.infer<typeof stockMediaAttributionSchema>;

export const stockMediaRenditionSchema = z
  .object({
    id: z.string().trim().min(1).max(160),
    url: externalHttpsUrlSchema,
    width: z.number().int().positive().max(32768),
    height: z.number().int().positive().max(32768),
    mimeType: z
      .string()
      .trim()
      .regex(/^(?:image|video)\/[a-z0-9.+-]+$/i)
      .optional(),
    fileSizeBytes: z.number().int().positive().max(2_147_483_647).optional(),
    durationSec: z.number().finite().positive().max(86_400).optional(),
  })
  .strict();
export type StockMediaRendition = z.infer<typeof stockMediaRenditionSchema>;

export const stockMediaCandidateSchema = z
  .object({
    providerId: stockProviderIdSchema,
    providerAssetId: providerAssetIdSchema,
    kind: stockMediaKindSchema,
    previewUrl: externalHttpsUrlSchema,
    sourcePageUrl: externalHttpsUrlSchema,
    creator: z.string().trim().min(1).max(240),
    creatorUrl: externalHttpsUrlSchema.optional(),
    width: z.number().int().positive().max(32768),
    height: z.number().int().positive().max(32768),
    durationSec: z.number().finite().positive().max(86_400).optional(),
    orientation: orientationSchema,
    mimeType: z
      .string()
      .trim()
      .regex(/^(?:image|video)\/[a-z0-9.+-]+$/i)
      .optional(),
    renderRenditions: z.array(stockMediaRenditionSchema).min(1).max(24),
    attribution: stockMediaAttributionSchema,
    acquisitionPolicy: stockMediaAcquisitionPolicySchema,
  })
  .strict()
  .superRefine((candidate, ctx) => {
    const aspectRatio = candidate.width / candidate.height;
    const expectedOrientation =
      aspectRatio >= 0.95 && aspectRatio <= 1.05
        ? "square"
        : aspectRatio > 1
          ? "landscape"
          : "portrait";
    if (candidate.orientation !== expectedOrientation) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["orientation"],
        message: "Orientation must match the candidate dimensions",
      });
    }

    if (
      candidate.mimeType &&
      !candidate.mimeType.startsWith(`${candidate.kind}/`)
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["mimeType"],
        message: `Candidate MIME type must match ${candidate.kind}`,
      });
    }
    if (candidate.kind === "image" && candidate.durationSec !== undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["durationSec"],
        message: "Image candidates cannot have a duration",
      });
    }

    const ids = new Set<string>();
    candidate.renderRenditions.forEach((rendition, index) => {
      if (ids.has(rendition.id)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["renderRenditions", index, "id"],
          message: "Rendition ids must be unique",
        });
      }
      ids.add(rendition.id);

      const mimeType = rendition.mimeType ?? candidate.mimeType;
      if (mimeType && !mimeType.startsWith(`${candidate.kind}/`)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["renderRenditions", index, "mimeType"],
          message: `Rendition MIME type must match ${candidate.kind}`,
        });
      }
      if (candidate.kind === "image" && rendition.durationSec !== undefined) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["renderRenditions", index, "durationSec"],
          message: "Image renditions cannot have a duration",
        });
      }
    });
  });
export type StockMediaCandidate = z.infer<typeof stockMediaCandidateSchema>;

export const stockMediaUsageEventSchema = z
  .object({
    state: z.enum(["not-required", "pending", "reported", "failed"]),
    reportedAt: z.string().datetime({ offset: true }).optional(),
    providerEventId: z.string().trim().min(1).max(240).optional(),
    error: z.string().trim().min(1).max(1000).optional(),
  })
  .strict()
  .superRefine((event, ctx) => {
    if (event.state === "reported" && !event.reportedAt) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["reportedAt"],
        message: "Reported usage events require a timestamp",
      });
    }
    if (event.state !== "reported" && event.reportedAt) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["reportedAt"],
        message: "Only reported usage events may contain a timestamp",
      });
    }
    if (event.state !== "reported" && event.providerEventId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["providerEventId"],
        message: "Only reported usage events may contain a provider event id",
      });
    }
    if (event.state !== "failed" && event.error) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["error"],
        message: "Only failed usage events may contain an error",
      });
    }
  });

export const stockMediaSourceRevisionSchema = z
  .object({
    capturedAt: z.string().datetime({ offset: true }),
    termsUrl: externalHttpsUrlSchema,
    providerUpdatedAt: z.string().datetime({ offset: true }).optional(),
    termsVersion: z.string().trim().min(1).max(160).optional(),
  })
  .strict();

/** Immutable selection payload retained after provider search results change. */
export const resolvedStockAssetSchema = z
  .object({
    schemaVersion: z.literal(1),
    resolvedAt: z.string().datetime({ offset: true }),
    localAssetId: z.string().trim().min(1).max(160).optional(),
    compliantRemoteUrl: externalHttpsUrlSchema.optional(),
    providerSnapshot: stockMediaCandidateSchema,
    sourceRevision: stockMediaSourceRevisionSchema,
    contentHash: z
      .string()
      .regex(/^[a-f0-9]{64}$/)
      .optional(),
    selectedRendition: stockMediaRenditionSchema,
    usageEvent: stockMediaUsageEventSchema,
  })
  .strict()
  .superRefine((asset, ctx) => {
    if (Boolean(asset.localAssetId) === Boolean(asset.compliantRemoteUrl)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          "Resolved stock assets require exactly one local asset or compliant remote URL",
      });
    }

    const selected = asset.providerSnapshot.renderRenditions.find(
      (rendition) => rendition.id === asset.selectedRendition.id,
    );
    if (
      !selected ||
      selected.url !== asset.selectedRendition.url ||
      selected.width !== asset.selectedRendition.width ||
      selected.height !== asset.selectedRendition.height ||
      selected.mimeType !== asset.selectedRendition.mimeType ||
      selected.fileSizeBytes !== asset.selectedRendition.fileSizeBytes ||
      selected.durationSec !== asset.selectedRendition.durationSec
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["selectedRendition"],
        message: "Selected rendition must come from the provider snapshot",
      });
    }

    const policy = asset.providerSnapshot.acquisitionPolicy;
    if (policy === "hotlink" && !asset.compliantRemoteUrl) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["compliantRemoteUrl"],
        message: "Hotlink selections must retain the compliant remote URL",
      });
    }
    if (policy === "download" && !asset.localAssetId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["localAssetId"],
        message: "Download selections must reference a local asset",
      });
    }
    if (asset.localAssetId && !asset.contentHash) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["contentHash"],
        message: "Local stock assets require an immutable SHA-256 hash",
      });
    }
    if (!asset.localAssetId && asset.contentHash) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["contentHash"],
        message: "Remote-only stock assets cannot claim a local content hash",
      });
    }
    if (
      asset.compliantRemoteUrl &&
      asset.compliantRemoteUrl !== asset.selectedRendition.url
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["compliantRemoteUrl"],
        message: "Remote selection URL must match the selected rendition",
      });
    }
  });
export type ResolvedStockAsset = z.infer<typeof resolvedStockAssetSchema>;

export interface StockMediaSelectionDTO {
  id: string;
  sceneId: string;
  snapshot: ResolvedStockAsset;
  createdAt: string;
  updatedAt: string;
}
