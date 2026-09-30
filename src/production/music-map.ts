import { z } from "zod";

export const musicMapSchema = z
  .object({
    version: z.literal(1),
    sourceUrl: z.string().min(1).max(2048),
    sourceHash: z.string().regex(/^[a-f0-9]{64}$/),
    durationSeconds: z.number().finite().positive().max(180),
    bpm: z.number().finite().min(40).max(240),
    offsetSeconds: z.number().finite().min(0).max(1.5),
    confidence: z.number().min(0).max(1),
    method: z.enum(["energy-onsets", "manual"]),
    disabledBeats: z.array(z.number().int().min(0).max(719)).max(720),
    dropSeconds: z.number().finite().nonnegative().max(180).nullable(),
  })
  .strict()
  .refine((map) => map.offsetSeconds < 60 / map.bpm, {
    message: "First beat offset must be less than one beat interval.",
  })
  .refine(
    (map) => map.dropSeconds === null || map.dropSeconds < map.durationSeconds,
    {
      message: "The drop must fall inside the track.",
    },
  );
export type MusicMap = z.infer<typeof musicMapSchema>;
export const musicMapEditSchema = z
  .object({
    expected: musicMapSchema,
    changes: z
      .object({
        bpm: z.number().finite().min(40).max(240).optional(),
        offsetSeconds: z.number().finite().min(0).max(1.5).optional(),
        disabledBeats: z
          .array(z.number().int().min(0).max(719))
          .max(720)
          .optional(),
        dropSeconds: z
          .number()
          .finite()
          .nonnegative()
          .max(180)
          .nullable()
          .optional(),
      })
      .strict(),
  })
  .strict();
export type MusicMapEdit = z.infer<typeof musicMapEditSchema>;

/** Review anchors restart at each music-loop boundary, just like the audio bed. */
export function musicBeatAnchors(map: MusicMap, seconds = map.durationSeconds) {
  const interval = 60 / map.bpm;
  const disabled = new Set(map.disabledBeats);
  const anchors: Array<{ index: number; seconds: number; disabled: boolean }> =
    [];
  for (
    let loop = 0;
    loop < seconds && anchors.length < 2400;
    loop += map.durationSeconds
  ) {
    for (let index = 0; index < 720; index++) {
      const local = map.offsetSeconds + index * interval;
      if (local >= map.durationSeconds || loop + local >= seconds) break;
      anchors.push({
        index,
        seconds: Math.round((loop + local) * 1000) / 1000,
        disabled: disabled.has(index),
      });
    }
  }
  return anchors;
}

/** Bounded energy-onset periodicity estimator. It proposes a grid, not downbeats.
 * Harmonic ambiguity is common; a creator reviews BPM/phase before using it.
 */
export function proposeMusicRhythm(samples: Float32Array, sampleRate: number) {
  if (
    !Number.isFinite(sampleRate) ||
    sampleRate <= 0 ||
    samples.length / sampleRate < 4
  )
    return undefined;
  const hop = Math.max(1, Math.round(sampleRate * 0.01));
  const envelope: number[] = [];
  for (
    let start = 0;
    start + hop <= Math.min(samples.length, sampleRate * 180);
    start += hop
  ) {
    let sum = 0;
    for (let index = start; index < start + hop; index++)
      sum += samples[index] ** 2;
    envelope.push(Math.sqrt(sum / hop));
  }
  const onsets = envelope.map((value, index) =>
    Math.max(0, value - (envelope[index - 1] ?? value)),
  );
  const power = onsets.reduce((sum, value) => sum + value * value, 0);
  if (!Number.isFinite(power) || power < 0.00001) return undefined;
  const hopSeconds = hop / sampleRate;
  let bestLag = 0;
  let score = 0;
  for (
    let lag = Math.round(60 / 180 / hopSeconds);
    lag <= Math.round(60 / 60 / hopSeconds);
    lag++
  ) {
    let dot = 0,
      left = 0,
      right = 0;
    for (let index = lag; index < onsets.length; index++) {
      dot += onsets[index] * onsets[index - lag];
      left += onsets[index] ** 2;
      right += onsets[index - lag] ** 2;
    }
    const candidate = dot / Math.max(1e-12, Math.sqrt(left * right));
    // Prefer the shorter periodic interval when equally supported (half-time is
    // still offered through the editable BPM field, never asserted as fact).
    if (candidate > score + 0.015) {
      score = candidate;
      bestLag = lag;
    }
  }
  if (!bestLag || score < 0.2) return undefined;
  let bestPhase = 0,
    phasePower = 0;
  for (let phase = 0; phase < bestLag; phase++) {
    let sum = 0;
    for (let index = phase; index < onsets.length; index += bestLag)
      sum += onsets[index];
    if (sum > phasePower) {
      phasePower = sum;
      bestPhase = phase;
    }
  }
  return {
    bpm: Math.round((60 / (bestLag * hopSeconds)) * 100) / 100,
    offsetSeconds: Math.round(bestPhase * hopSeconds * 1000) / 1000,
    confidence: Math.round(Math.min(0.95, score) * 100) / 100,
  };
}
