/**
 * Where the voice is actually speaking (roadmap V4b). A narration take is
 * speech with short pauses at commas and sentence ends and a longer tail after
 * each scene. Finding those spans from the waveform lets word timing skip the
 * silences instead of spreading words over them.
 *
 * Pure and deterministic: the same samples always give the same spans.
 */

export type SpeechSpan = [startSeconds: number, endSeconds: number];

const WINDOW_SECONDS = 0.025;
const HOP_SECONDS = 0.01;
/** A gap shorter than this is a breath or a consonant, not a pause. */
const MIN_GAP_SECONDS = 0.12;
/** A burst shorter than this is a click, not speech. */
const MIN_SPAN_SECONDS = 0.05;

/** Voiced spans of 16-bit mono PCM, in seconds. */
export function speechSpansFromPcm(
  samples: Int16Array,
  sampleRate: number,
): SpeechSpan[] {
  const win = Math.max(1, Math.round(WINDOW_SECONDS * sampleRate));
  const hop = Math.max(1, Math.round(HOP_SECONDS * sampleRate));
  const rms: number[] = [];
  for (let at = 0; at + win <= samples.length; at += hop) {
    let sum = 0;
    for (let i = at; i < at + win; i++) {
      const v = samples[i]! / 32768;
      sum += v * v;
    }
    rms.push(Math.sqrt(sum / win));
  }
  if (!rms.length) return [];
  const sorted = [...rms].sort((a, b) => a - b);
  const floor = sorted[Math.floor(sorted.length * 0.1)]!;
  const peak = sorted[Math.floor(sorted.length * 0.98)]!;
  // Above the room's noise and a few percent of the voice's own level.
  const on = Math.max(floor * 4, peak * 0.04, 0.002);
  const spans: SpeechSpan[] = [];
  let start = -1;
  for (const [i, level] of rms.entries()) {
    if (level >= on) {
      if (start < 0) start = i;
    } else if (start >= 0) {
      spans.push([start * HOP_SECONDS, (i - 1) * HOP_SECONDS + WINDOW_SECONDS]);
      start = -1;
    }
  }
  if (start >= 0)
    spans.push([
      start * HOP_SECONDS,
      rms.length * HOP_SECONDS + WINDOW_SECONDS,
    ]);
  const merged: SpeechSpan[] = [];
  for (const span of spans) {
    const last = merged[merged.length - 1];
    if (last && span[0] - last[1] < MIN_GAP_SECONDS) last[1] = span[1];
    else merged.push([...span]);
  }
  return merged.filter(([a, b]) => b - a >= MIN_SPAN_SECONDS);
}

/** Voiced spans clipped to a window, in seconds. */
export function clipSpans(
  spans: SpeechSpan[],
  from: number,
  to: number,
): SpeechSpan[] {
  const out: SpeechSpan[] = [];
  for (const [a, b] of spans) {
    const start = Math.max(a, from);
    const end = Math.min(b, to);
    if (end > start) out.push([start, end]);
  }
  return out;
}

/** The time at a fraction (0 to 1) of the voiced duration inside the spans. */
export function timeAtVoicedFraction(
  spans: SpeechSpan[],
  fraction: number,
): number {
  const total = spans.reduce((sum, [a, b]) => sum + (b - a), 0);
  let left = Math.min(Math.max(fraction, 0), 1) * total;
  for (const [a, b] of spans) {
    if (left <= b - a) return a + left;
    left -= b - a;
  }
  return spans[spans.length - 1]![1];
}
