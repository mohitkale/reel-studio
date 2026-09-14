// @vitest-environment node
import { describe, expect, it } from "vitest";

import {
  analyzeWav,
  finalizeSpeechWav,
  transcodeAudioToWav,
  transcodeWavToMp3,
} from "@/lib/audio-production";
import {
  buildAudioMixPlan,
  clipVolumeAtFrame,
  musicVolumeAtFrame,
} from "@/lib/audio-mix";
import { makeSilentWav, pcmToWav } from "@/lib/wav";

function toneWav(seconds = 0.5, amplitude = 0.08): Buffer {
  const sampleRate = 44_100;
  const pcm = Buffer.alloc(Math.round(seconds * sampleRate) * 2);
  for (let i = 0; i < pcm.length / 2; i++) {
    pcm.writeInt16LE(
      Math.round(
        Math.sin((i / sampleRate) * Math.PI * 2 * 440) * amplitude * 32767,
      ),
      i * 2,
    );
  }
  return pcmToWav(pcm, { sampleRate, channels: 1, bitsPerSample: 16 });
}

describe("audio production", () => {
  it("applies fades and narration ducking through one shared envelope", () => {
    const plan = buildAudioMixPlan({
      fps: 30,
      totalFrames: 300,
      musicVolume: 40,
      narration: [{ startFrame: 60, durationFrames: 90 }],
    });
    expect(musicVolumeAtFrame(0, plan)).toBe(0);
    expect(musicVolumeAtFrame(30, plan)).toBeCloseTo(0.4);
    expect(musicVolumeAtFrame(90, plan)).toBeCloseTo(0.14);
    expect(musicVolumeAtFrame(300, plan)).toBe(0);
    expect(clipVolumeAtFrame(0, 60, 0.5, 6)).toBe(0);
    expect(clipVolumeAtFrame(30, 60, 0.5, 6)).toBe(0.5);
    expect(clipVolumeAtFrame(60, 60, 0.5, 6)).toBe(0);
  });

  it("normalizes valid speech-like audio and rejects silence", () => {
    const finalized = finalizeSpeechWav(toneWav());
    expect(finalized.analysis.durationSeconds).toBeCloseTo(0.5, 2);
    expect(finalized.analysis.activeSampleRatio).toBeGreaterThan(0.5);
    expect(() => finalizeSpeechWav(makeSilentWav(0.5))).toThrow(
      "unexpected silence",
    );
  });

  it("produces a decodable MP3 export when ffmpeg is installed", async () => {
    const mp3 = await transcodeWavToMp3(toneWav());
    expect(mp3.length).toBeGreaterThan(1_000);
    expect(mp3.subarray(0, 3).toString("ascii")).toMatch(/ID3|\xFF/);
    expect(analyzeWav(toneWav()).clipped).toBe(false);
    const decoded = await transcodeAudioToWav(mp3, { maxSeconds: 0.25 });
    expect(analyzeWav(decoded).durationSeconds).toBeCloseTo(0.25, 1);
  });
});
