import { describe, expect, it } from "vitest";

import { pcmToWav } from "@/lib/wav";

import { buildPresenterTrack, loudness } from "./presenter-track";

/** One second of 440 Hz tone followed by one second of silence, mono 16-bit at 16 kHz. */
function toneThenSilence(): Buffer {
  const rate = 16000;
  const pcm = Buffer.alloc(rate * 2 * 2);
  for (let i = 0; i < rate; i++)
    pcm.writeInt16LE(
      Math.round(Math.sin((2 * Math.PI * 440 * i) / rate) * 20000),
      i * 2,
    );
  return pcmToWav(pcm, { sampleRate: rate, channels: 1, bitsPerSample: 16 });
}

describe("loudness", () => {
  it("is high while there is sound and zero in silence", () => {
    const level = loudness(toneThenSilence());
    expect(level(0.5)).toBeGreaterThan(0.8);
    expect(level(1.5)).toBeLessThan(0.05);
  });
});

describe("presenter track", () => {
  const words = [
    { text: "Hello", start: 0.3, end: 0.8 },
    { text: "world.", start: 0.9, end: 1.4 },
    { text: "नमस्ते", start: 1.5, end: 1.9 },
  ];

  it("uses eSpeak phonemes for English words and loudness for the rest", async () => {
    const track = await buildPresenterTrack({
      words,
      wav: toneThenSilence(),
      seconds: 2,
      seed: "a",
      language: "en",
    });
    const shapes = new Set(track.mouth.map((k) => k.viseme));
    // "Hello" and "world" give more than an open and shut mouth.
    expect(shapes.size).toBeGreaterThanOrEqual(4);
    expect(shapes.has("l")).toBe(true);
    expect(track.mouth.at(0)!.viseme).toBe("rest");
    // The last word is in the silent half, so its mouth stays shut.
    const last = track.mouth.filter((k) => k.start >= 1.5);
    expect(last.every((k) => k.viseme === "rest")).toBe(true);
  });

  it("follows loudness only for another language, and is repeatable", async () => {
    const input = {
      words,
      wav: toneThenSilence(),
      seconds: 2,
      seed: "a",
      language: "hi",
    };
    const track = await buildPresenterTrack(input);
    expect(new Set(track.mouth.map((k) => k.viseme))).toEqual(
      new Set(["rest", "ah"]),
    );
    expect(await buildPresenterTrack(input)).toEqual(track);
  });
});
