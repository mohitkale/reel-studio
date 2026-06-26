import { describe, it, expect } from "vitest";

import { parseWav, pcmToWav } from "./wav";
import { normalizeWavLoudness } from "./audio-normalize";

/** Build a mono 16-bit WAV from a constant-amplitude tone (alternating ±amp). */
function toneWav(amp: number, samples = 44100): Buffer {
  const pcm = Buffer.alloc(samples * 2);
  for (let i = 0; i < samples; i++) {
    const v = i % 2 === 0 ? amp : -amp;
    pcm.writeInt16LE(Math.round(v * 32767), i * 2);
  }
  return pcmToWav(pcm, { sampleRate: 44100, channels: 1, bitsPerSample: 16 });
}

function peakOf(wav: Buffer): number {
  const info = parseWav(wav);
  const pcm = wav.subarray(info.dataOffset, info.dataOffset + info.dataLength);
  let peak = 0;
  for (let i = 0; i < pcm.length / 2; i++) {
    peak = Math.max(peak, Math.abs(pcm.readInt16LE(i * 2) / 32768));
  }
  return peak;
}

describe("normalizeWavLoudness", () => {
  it("amplifies a quiet take toward the target loudness", () => {
    const quiet = toneWav(0.02); // ~ -34 dBFS, well below target
    const out = normalizeWavLoudness(quiet);
    expect(peakOf(out)).toBeGreaterThan(peakOf(quiet) * 3);
  });

  it("never pushes the peak above the ceiling (no clipping)", () => {
    const out = normalizeWavLoudness(toneWav(0.02));
    // Peak ceiling is -1 dBFS ≈ 0.891 linear.
    expect(peakOf(out)).toBeLessThanOrEqual(0.9);
  });

  it("leaves pure silence untouched", () => {
    const silent = pcmToWav(Buffer.alloc(44100 * 2), {
      sampleRate: 44100,
      channels: 1,
      bitsPerSample: 16,
    });
    expect(normalizeWavLoudness(silent).equals(silent)).toBe(true);
  });

  it("does not blow up an already-loud take past the ceiling", () => {
    const loud = toneWav(0.95);
    expect(peakOf(normalizeWavLoudness(loud))).toBeLessThanOrEqual(0.92);
  });
});
