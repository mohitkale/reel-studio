// @vitest-environment node
import { describe, expect, it } from "vitest";

import { masterToLufs, measureLufs } from "@/lib/loudness";
import { pcmToWav } from "@/lib/wav";

/** A speech-like signal: a 220 Hz tone with a 3 Hz amplitude swell, at a chosen peak. */
function tone(seconds: number, peak: number, rate = 44100) {
  const pcm = Buffer.alloc(seconds * rate * 2);
  for (let i = 0; i < seconds * rate; i++) {
    const swell = 0.6 + 0.4 * Math.sin((2 * Math.PI * 3 * i) / rate);
    const v = Math.sin((2 * Math.PI * 220 * i) / rate) * swell * peak;
    pcm.writeInt16LE(Math.round(v * 32767), i * 2);
  }
  return pcmToWav(pcm, { sampleRate: rate });
}

describe("loudness mastering", () => {
  it("measures a quieter file as quieter", async () => {
    const quiet = await measureLufs(tone(6, 0.05));
    const loud = await measureLufs(tone(6, 0.5));
    expect(quiet).not.toBeNull();
    expect(loud! - quiet!).toBeGreaterThan(15);
  });

  it("brings quiet and loud material to -16 LUFS within one LU", async () => {
    for (const peak of [0.04, 0.9]) {
      const mastered = await masterToLufs(tone(8, peak), { targetLufs: -16 });
      const lufs = await measureLufs(mastered);
      expect(lufs, `peak ${peak}`).not.toBeNull();
      expect(Math.abs(lufs! + 16)).toBeLessThan(1);
    }
  }, 60_000);

  it("keeps the format of a mono 16-bit file", async () => {
    const mastered = await masterToLufs(tone(4, 0.2), {
      sampleRate: 44100,
      channels: 1,
    });
    expect(mastered.toString("ascii", 0, 4)).toBe("RIFF");
    expect(mastered.readUInt16LE(22)).toBe(1);
    expect(mastered.readUInt32LE(24)).toBe(44100);
    expect(mastered.readUInt16LE(34)).toBe(16);
  });

  it("leaves silence alone", async () => {
    const silent = pcmToWav(Buffer.alloc(44100 * 2 * 2), { sampleRate: 44100 });
    expect(await measureLufs(silent)).toBeNull();
    expect(await masterToLufs(silent)).toEqual(silent);
  });
});
