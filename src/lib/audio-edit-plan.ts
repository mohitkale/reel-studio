import { z } from "zod";
export const audioRangeSchema = z
  .object({
    start: z.number().finite().nonnegative(),
    end: z.number().finite().positive(),
  })
  .refine((r) => r.end > r.start, "End must follow start");
export const audioEditPlanSchema = z
  .object({
    version: z.literal(1),
    ranges: z.array(audioRangeSchema).min(1).max(200),
    gains: z.record(z.string().max(80), z.number().finite().min(0).max(2)),
    cleanup: z.boolean(),
  })
  .superRefine((plan, ctx) => {
    for (let i = 1; i < plan.ranges.length; i++)
      if (plan.ranges[i].start < plan.ranges[i - 1].end)
        ctx.addIssue({
          code: "custom",
          message: "Ranges must remain in source order without overlap",
          path: ["ranges", i],
        });
  });
export type AudioEditPlan = z.infer<typeof audioEditPlanSchema>;
export interface AudioSegment {
  id: string;
  text: string;
  start: number;
  end: number;
  speaker: string;
  /** Segment text needs review when a cut removes part of the spoken passage. */
  textNeedsReview?: boolean;
}
export function cutAudioRange(
  plan: AudioEditPlan,
  start: number,
  end: number,
): AudioEditPlan {
  if (
    !Number.isFinite(start) ||
    !Number.isFinite(end) ||
    start < 0 ||
    end <= start
  )
    throw new Error("Select a valid range first");
  const ranges = plan.ranges.flatMap((r) =>
    end <= r.start || start >= r.end
      ? [r]
      : [
          { start: r.start, end: Math.min(start, r.end) },
          { start: Math.max(end, r.start), end: r.end },
        ].filter((x) => x.end - x.start > 0.001),
  );
  return audioEditPlanSchema.parse({ ...plan, ranges });
}
export function rebaseAudioSegments(
  segments: AudioSegment[],
  ranges: AudioEditPlan["ranges"],
): AudioSegment[] {
  let cursor = 0;
  const result: AudioSegment[] = [];
  for (const range of ranges) {
    for (const s of segments) {
      const start = Math.max(s.start, range.start),
        end = Math.min(s.end, range.end);
      if (end > start)
        result.push({
          ...s,
          ...(start > s.start || end < s.end ? { textNeedsReview: true } : {}),
          start: cursor + start - range.start,
          end: cursor + end - range.start,
        });
    }
    cursor += range.end - range.start;
  }
  return result;
}
export function waveformPeaks(samples: Float32Array, bins = 160): number[] {
  return Array.from({ length: bins }, (_, i) => {
    let max = 0;
    const from = Math.floor((i * samples.length) / bins),
      to = Math.floor(((i + 1) * samples.length) / bins);
    for (let j = from; j < to; j++) max = Math.max(max, Math.abs(samples[j]));
    return max;
  });
}
/** Standard interleaved 16-bit PCM, usable in browsers without Node Buffer. */
export function encodeAudioWav(
  channels: Float32Array[],
  sampleRate: number,
): ArrayBuffer {
  if (
    !channels.length ||
    channels.length > 2 ||
    !Number.isInteger(sampleRate) ||
    sampleRate < 8000 ||
    channels.some((c) => c.length !== channels[0].length)
  )
    throw new Error("Invalid audio format");
  const frames = channels[0].length,
    bytes = frames * channels.length * 2;
  const buffer = new ArrayBuffer(44 + bytes),
    view = new DataView(buffer);
  const tag = (offset: number, value: string) => {
    for (let i = 0; i < value.length; i++)
      view.setUint8(offset + i, value.charCodeAt(i));
  };
  tag(0, "RIFF");
  view.setUint32(4, 36 + bytes, true);
  tag(8, "WAVE");
  tag(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, channels.length, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * channels.length * 2, true);
  view.setUint16(32, channels.length * 2, true);
  view.setUint16(34, 16, true);
  tag(36, "data");
  view.setUint32(40, bytes, true);
  for (let f = 0; f < frames; f++)
    for (let c = 0; c < channels.length; c++) {
      const v = Math.max(-1, Math.min(1, channels[c][f]));
      view.setInt16(
        44 + (f * channels.length + c) * 2,
        v < 0 ? v * 32768 : v * 32767,
        true,
      );
    }
  return buffer;
}
