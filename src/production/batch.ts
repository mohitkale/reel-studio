import { z } from "zod";

import { ORIENTATIONS, orientationSchema } from "@/lib/orientation";
import { voiceProviderIdSchema } from "@/production/api";

const rowFields = {
  key: z
    .string()
    .trim()
    .min(1)
    .max(80)
    .regex(/^[a-zA-Z0-9._-]+$/)
    .optional(),
  label: z.string().trim().min(1).max(120).optional(),
};

const variantOrientationsSchema = z
  .array(orientationSchema)
  .min(1)
  .max(3)
  .refine((values) => new Set(values).size === values.length, {
    message: "Format variants must be unique",
  })
  .default([...ORIENTATIONS]);

export const productionBatchRowSchema = z.discriminatedUnion("kind", [
  z.object({
    ...rowFields,
    kind: z.literal("video"),
    scriptId: z.string().min(1),
    voiceTakeId: z.string().min(1).optional(),
    orientations: variantOrientationsSchema,
    quality: z.enum(["draft", "standard", "high"]).default("standard"),
  }),
  z.object({
    ...rowFields,
    kind: z.literal("audio"),
    scriptId: z.string().min(1),
    providerId: voiceProviderIdSchema.optional(),
    voiceId: z.string().min(1).optional(),
    modelId: z.string().min(1).optional(),
    placeholder: z.boolean().default(false),
  }),
  z.object({
    ...rowFields,
    kind: z.literal("podcast"),
    podcastId: z.string().min(1),
    regenerateTurnIds: z.array(z.string().min(1)).max(120).optional(),
  }),
  z.object({
    ...rowFields,
    kind: z.literal("audiogram"),
    takeId: z.string().min(1),
    startTurnId: z.string().min(1),
    endTurnId: z.string().min(1),
    orientations: variantOrientationsSchema,
    quality: z.enum(["draft", "standard", "high"]).default("standard"),
  }),
]);

export const productionBatchRequestSchema = z
  .object({
    idempotencyKey: z.string().min(8).max(120),
    rows: z.array(productionBatchRowSchema).min(1).max(10),
    runMode: z.enum(["automatic", "approval"]).default("automatic"),
    priority: z.number().int().min(-100).max(100).default(0),
  })
  .superRefine((batch, context) => {
    const keys = new Set<string>();
    batch.rows.forEach((row, index) => {
      if (!row.key) return;
      if (keys.has(row.key)) {
        context.addIssue({
          code: "custom",
          message: `Duplicate row key: ${row.key}`,
          path: ["rows", index, "key"],
        });
      }
      keys.add(row.key);
    });
  });

export type ProductionBatchRequest = z.infer<
  typeof productionBatchRequestSchema
>;
export type ProductionBatchRow = z.infer<typeof productionBatchRowSchema>;

export interface ExpandedProductionBatchItem {
  rowIndex: number;
  variantIndex: number;
  label?: string;
  orientation?: (typeof ORIENTATIONS)[number];
  request: {
    idempotencyKey: string;
    runMode: ProductionBatchRequest["runMode"];
    priority: number;
  } & (
    | {
        kind: "video";
        scriptId: string;
        voiceTakeId?: string;
        orientation: (typeof ORIENTATIONS)[number];
        quality: "draft" | "standard" | "high";
      }
    | {
        kind: "audio";
        scriptId: string;
        providerId?: z.infer<typeof voiceProviderIdSchema>;
        voiceId?: string;
        modelId?: string;
        placeholder: boolean;
        label?: string;
      }
    | {
        kind: "podcast";
        podcastId: string;
        regenerateTurnIds?: string[];
        label?: string;
      }
    | {
        kind: "audiogram";
        takeId: string;
        startTurnId: string;
        endTurnId: string;
        orientation: (typeof ORIENTATIONS)[number];
        quality: "draft" | "standard" | "high";
      }
  );
}

export function expandProductionBatch(
  batch: ProductionBatchRequest,
): ExpandedProductionBatchItem[] {
  const items: ExpandedProductionBatchItem[] = [];
  batch.rows.forEach((row, rowIndex) => {
    const baseKey = row.key ?? `row-${rowIndex + 1}`;
    if (row.kind === "video") {
      const { key: _key, label, orientations, ...request } = row;
      void _key;
      orientations.forEach((orientation, variantIndex) => {
        items.push({
          rowIndex,
          variantIndex,
          label,
          orientation,
          request: {
            ...request,
            orientation,
            idempotencyKey: `${batch.idempotencyKey}:${baseKey}:${orientation}`,
            runMode: batch.runMode,
            priority: batch.priority,
          },
        });
      });
      return;
    }
    if (row.kind === "audiogram") {
      const { key: _key, label, orientations, ...request } = row;
      void _key;
      orientations.forEach((orientation, variantIndex) => {
        items.push({
          rowIndex,
          variantIndex,
          label,
          orientation,
          request: {
            ...request,
            orientation,
            idempotencyKey: `${batch.idempotencyKey}:${baseKey}:${orientation}`,
            runMode: batch.runMode,
            priority: batch.priority,
          },
        });
      });
      return;
    }
    const { key: _key, ...request } = row;
    void _key;
    items.push({
      rowIndex,
      variantIndex: 0,
      label: row.label,
      request: {
        ...request,
        idempotencyKey: `${batch.idempotencyKey}:${baseKey}`,
        runMode: batch.runMode,
        priority: batch.priority,
      },
    });
  });
  return items;
}
