import { z } from "zod";

export const audioMasteringSchema = z.enum(["original", "balanced"]);
export type AudioMastering = z.infer<typeof audioMasteringSchema>;
/** A product target, not a claim of compliance with any publishing platform. */
export const BALANCED_AUDIO_TARGET = {
  integratedLufs: -16,
  maxTruePeakDbtp: -1,
  loudnessRangeLu: 11,
} as const;
export const loudnessMeasurementSchema = z.object({
  integratedLufs: z.number().finite(),
  truePeakDbtp: z.number().finite(),
  loudnessRangeLu: z.number().finite(),
  thresholdLufs: z.number().finite(),
});
export const audioMasteringReportSchema = z.object({
  version: z.literal(1),
  mode: z.literal("balanced"),
  status: z.enum(["verified", "no-audio", "unmeasurable"]),
  target: z.object({
    integratedLufs: z.literal(-16),
    maxTruePeakDbtp: z.literal(-1),
    loudnessRangeLu: z.literal(11),
  }),
  before: loudnessMeasurementSchema.nullable(),
  after: loudnessMeasurementSchema.nullable(),
  outputSha256: z.string().regex(/^[a-f0-9]{64}$/),
});
export type AudioMasteringReport = z.infer<typeof audioMasteringReportSchema>;
