import { z } from "zod";

export const audioMasteringSchema = z.enum(["original", "balanced", "social"]);
export type AudioMastering = z.infer<typeof audioMasteringSchema>;
/** A product target, not a claim of compliance with any publishing platform. */
export const BALANCED_AUDIO_TARGET = {
  integratedLufs: -16,
  maxTruePeakDbtp: -1,
  loudnessRangeLu: 11,
} as const;
/** Short-form delivery: louder, as phone feeds expect. Same peak ceiling. */
export const SOCIAL_AUDIO_TARGET = {
  integratedLufs: -14,
  maxTruePeakDbtp: -1,
  loudnessRangeLu: 11,
} as const;
export function audioTargetFor(mode: Exclude<AudioMastering, "original">) {
  return mode === "social" ? SOCIAL_AUDIO_TARGET : BALANCED_AUDIO_TARGET;
}
export const loudnessMeasurementSchema = z.object({
  integratedLufs: z.number().finite(),
  truePeakDbtp: z.number().finite(),
  loudnessRangeLu: z.number().finite(),
  thresholdLufs: z.number().finite(),
});
export const audioMasteringReportSchema = z.object({
  version: z.literal(1),
  mode: z.enum(["balanced", "social"]),
  status: z.enum(["verified", "no-audio", "unmeasurable"]),
  target: z.object({
    integratedLufs: z.union([z.literal(-16), z.literal(-14)]),
    maxTruePeakDbtp: z.literal(-1),
    loudnessRangeLu: z.literal(11),
  }),
  before: loudnessMeasurementSchema.nullable(),
  after: loudnessMeasurementSchema.nullable(),
  outputSha256: z.string().regex(/^[a-f0-9]{64}$/),
});
export type AudioMasteringReport = z.infer<typeof audioMasteringReportSchema>;
