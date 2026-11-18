// @vitest-environment node
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import {
  MUSIC_LIBRARY,
  snapToBeat,
  suggestBundledTrack,
  suggestTrackForText,
  trackBeatTimes,
} from "@/lib/music-library";
import { THEMES } from "@/video/themes";

function readWav(file: string) {
  const bytes = readFileSync(file);
  expect(bytes.toString("ascii", 0, 4)).toBe("RIFF");
  expect(bytes.readUInt16LE(22)).toBe(1); // mono
  expect(bytes.readUInt32LE(24)).toBe(32000);
  expect(bytes.readUInt16LE(34)).toBe(16);
  const pcm = bytes.subarray(44);
  const samples = new Float32Array(pcm.length / 2);
  for (let i = 0; i < samples.length; i++)
    samples[i] = pcm.readInt16LE(i * 2) / 32768;
  return samples;
}

describe("the bundled library", () => {
  it("has about twenty uniquely named tracks across the moods", () => {
    expect(MUSIC_LIBRARY.length).toBeGreaterThanOrEqual(20);
    expect(new Set(MUSIC_LIBRARY.map((t) => t.id)).size).toBe(
      MUSIC_LIBRARY.length,
    );
    const tags = new Set(MUSIC_LIBRARY.flatMap((t) => t.tags));
    for (const tag of [
      "upbeat",
      "calm",
      "tech",
      "cinematic",
      "lo-fi",
      "corporate",
      "playful",
      "dramatic",
    ])
      expect(tags.has(tag as never), tag).toBe(true);
  });

  it("holds a whole number of beats in each loop, so the grid is exact", () => {
    for (const t of MUSIC_LIBRARY) {
      const beats = (t.loopSeconds * t.bpm) / 60;
      expect(Number.isInteger(beats), `${t.id} has ${beats} beats`).toBe(true);
      expect(t.offsetSeconds).toBeLessThan(60 / t.bpm);
    }
  });

  for (const t of MUSIC_LIBRARY) {
    it(`${t.id}: a 16 s loop, sensible level, no click at the seam`, () => {
      const file = path.join(process.cwd(), "public", t.url);
      expect(existsSync(file), file).toBe(true);
      const samples = readWav(file);
      expect(samples.length).toBe(32000 * t.loopSeconds);
      let peak = 0;
      let sum = 0;
      for (const v of samples) {
        peak = Math.max(peak, Math.abs(v));
        sum += v * v;
      }
      const rms = Math.sqrt(sum / samples.length);
      expect(peak).toBeGreaterThan(0.3);
      expect(peak).toBeLessThanOrEqual(1);
      expect(rms).toBeGreaterThan(0.02);
      // The jump from the last sample back to the first must look like any other step.
      const steps = new Float32Array(samples.length - 1);
      for (let i = 0; i < steps.length; i++)
        steps[i] = Math.abs(samples[i + 1]! - samples[i]!);
      const sorted = [...steps].sort((a, b) => a - b);
      const typical = sorted[Math.floor(sorted.length * 0.999)]!;
      expect(Math.abs(samples[0]! - samples.at(-1)!)).toBeLessThanOrEqual(
        typical * 2 + 1e-4,
      );
    });
  }
});

describe("choosing and snapping", () => {
  it("keeps the old mood lookup working", () => {
    expect(suggestBundledTrack("calm")?.id).toBe("lofi-chill");
    expect(suggestBundledTrack("tech")?.id).toBe("tech-minimal");
    expect(suggestBundledTrack("nope")).toBeUndefined();
  });

  it("gives every theme a track that fits its music mood, the same every time", () => {
    for (const theme of THEMES) {
      const pick = suggestTrackForText(theme.musicMood);
      expect(pick, `${theme.id} (${theme.musicMood})`).toBeDefined();
      expect(suggestTrackForText(theme.musicMood)).toEqual(pick);
    }
    expect(suggestTrackForText("upbeat pop")?.tags).toContain("upbeat");
    expect(suggestTrackForText("corporate uplifting")?.tags).toContain(
      "corporate",
    );
    expect(suggestTrackForText("")).toBeUndefined();
  });

  it("lists beats and loops them", () => {
    const t = MUSIC_LIBRARY.find((x) => x.id === "cinematic-tension")!; // 60 bpm, 16 s loop
    expect(trackBeatTimes(t, 3)).toEqual([0, 1, 2]);
    expect(trackBeatTimes(t, 17.5).slice(15, 18)).toEqual([15, 16, 17]);
  });

  it("snaps a cut to a beat only when one is close", () => {
    const t = MUSIC_LIBRARY.find((x) => x.id === "tech-minimal")!; // 120 bpm: beats every 0.5 s
    expect(snapToBeat(4.62, t)).toBe(4.5);
    expect(snapToBeat(4.74, t)).toBe(4.5); // 0.24 s from a beat
    expect(snapToBeat(4.76, t)).toBe(5); // 0.24 s from the next one
    expect(snapToBeat(4.99, t, 0.005)).toBe(4.99); // too far for a tight tolerance
    const slow = MUSIC_LIBRARY.find((x) => x.id === "cinematic-tension")!; // beats every 1 s
    expect(snapToBeat(4.5, slow, 0.25)).toBe(4.5);
  });
});
