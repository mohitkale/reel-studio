// @vitest-environment node
import { readFileSync } from "node:fs";
import { expect, it } from "vitest";
import { SFX_LIBRARY } from "@/lib/sfx-library";
import { parseWav } from "@/lib/wav";

it("pins durations and audible peaks to the actual bundled audio", () => {
  for (const clip of SFX_LIBRARY) {
    const wav = readFileSync(`public${clip.url}`);
    const info = parseWav(wav);
    const windowSize = Math.round(info.sampleRate * 0.01);
    const frames = info.dataLength / 2;
    let largest = -1;
    let peak = 0;
    for (let start = 0; start < frames; start += windowSize) {
      let energy = 0;
      const length = Math.min(windowSize, frames - start);
      for (let index = 0; index < length; index++) {
        const sample = wav.readInt16LE(info.dataOffset + (start + index) * 2);
        energy += sample * sample;
      }
      if (energy / length > largest) {
        largest = energy / length;
        peak = (start + length / 2) / info.sampleRate;
      }
    }
    expect(info.channels).toBe(1);
    expect(info.bitsPerSample).toBe(16);
    expect(clip.durationSeconds).toBeCloseTo(info.durationSeconds, 5);
    expect(clip.peakOffsetSeconds).toBeCloseTo(peak, 5);
  }
});
