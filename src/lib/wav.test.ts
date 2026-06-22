import { describe, it, expect } from "vitest";

import { makeSilentWav, parseWav, pcmToWav } from "./wav";

describe("wav", () => {
  it("round-trips PCM through a WAV header", () => {
    const pcm = Buffer.alloc(44100 * 2); // 1s of 16-bit mono @ 44100
    const wav = pcmToWav(pcm);
    const info = parseWav(wav);
    expect(info.sampleRate).toBe(44100);
    expect(info.channels).toBe(1);
    expect(info.bitsPerSample).toBe(16);
    expect(info.dataLength).toBe(pcm.length);
    expect(info.durationSeconds).toBeCloseTo(1, 5);
  });

  it("measures the duration of a silent WAV", () => {
    const wav = makeSilentWav(2.5);
    const info = parseWav(wav);
    expect(info.durationSeconds).toBeCloseTo(2.5, 3);
  });

  it("rejects non-WAV buffers", () => {
    expect(() => parseWav(Buffer.from("not a wav"))).toThrow();
  });
});
