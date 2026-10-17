import { z } from "zod";
import { orientationSchema } from "@/lib/orientation";
import { videoScriptSnapshotSchema } from "./video-snapshot";

export const FACTORY_LIMITS = {
  profiles: 50,
  runs: 50,
  packs: 20,
  versionsPerProfile: 20,
  variants: 6,
  snapshotBytes: 4 * 1024 * 1024,
  packBytes: 64 * 1024 * 1024,
  cutAudioBytes: 128 * 1024 * 1024,
  runSeconds: 1800,
} as const;
const key = z
  .string()
  .min(1)
  .max(64)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
export const factoryProfileRequestSchema = z
  .object({
    key,
    version: z.number().int().min(1).max(20),
    name: z.string().trim().min(1).max(120),
    sourceRevisionId: z.string().min(1).max(160),
    orientations: z
      .array(orientationSchema)
      .min(1)
      .max(3)
      .refine((v) => new Set(v).size === v.length, "Choose distinct formats"),
    quality: z.enum(["draft", "standard", "high"]).default("standard"),
  })
  .strict();
export const factoryDesignSchema = videoScriptSnapshotSchema.pick({
  brandTokens: true,
  styleId: true,
  energy: true,
  visualTheme: true,
  productionPreset: true,
});
export const factoryProfileDocumentSchema = factoryProfileRequestSchema
  .extend({
    schemaVersion: z.literal(1),
    design: factoryDesignSchema,
    packDigest: z.string().regex(/^sha256:[a-f0-9]{64}$/),
  })
  .strict();
export type FactoryProfileDocument = z.infer<
  typeof factoryProfileDocumentSchema
>;
const variant = {
  key,
  label: z.string().trim().min(1).max(120),
  orientation: orientationSchema,
};
export const factoryVariantSchema = z.discriminatedUnion("kind", [
  z.object({ ...variant, kind: z.literal("aspect") }).strict(),
  z
    .object({
      ...variant,
      kind: z.literal("cutdown"),
      sceneIds: z.array(z.string().min(1).max(160)).min(1).max(20),
    })
    .strict(),
]);
export type FactoryVariant = z.infer<typeof factoryVariantSchema>;
export const factoryRunRequestSchema = z
  .object({
    idempotencyKey: z.string().min(8).max(100),
    sourceRevisionId: z.string().min(1).max(160),
    profileId: z.string().min(1).max(160).optional(),
    variants: z.array(factoryVariantSchema).min(1).max(FACTORY_LIMITS.variants),
    quality: z.enum(["draft", "standard", "high"]).optional(),
    runMode: z.enum(["automatic", "approval"]).default("approval"),
  })
  .strict()
  .refine(
    (v) =>
      new Set(v.variants.map((item) => item.key)).size === v.variants.length,
    "Variant keys must be unique",
  );
export type FactoryRunRequest = z.infer<typeof factoryRunRequestSchema>;
