import { describe, expect, it } from "vitest";

import { pcmToWav } from "@/lib/wav";

import {
  buildPresenterTrack,
  fitWordsToSound,
  loudness,
} from "./presenter-track";

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

describe("fitting recognised word times to the sound", () => {
  // The voice sounds from 1.0 to 1.4 s and again from 2.0 to 2.3 s.
  const sound = (t: number) =>
    (t >= 1 && t < 1.4) || (t >= 2 && t < 2.3) ? 1 : 0;

  it("ends a word at its first silence even when the recogniser let it run into the next word", () => {
    const [a, b] = fitWordsToSound(
      [
        { text: "one", start: 1.0, end: 2.2 },
        { text: "two", start: 2.2, end: 2.6 },
      ],
      sound,
    );
    expect(a!.start).toBeCloseTo(1.0, 1);
    expect(a!.end).toBeLessThan(1.6);
    expect(b!.start).toBeGreaterThanOrEqual(a!.end);
  });

  it("moves a start that landed inside the silence before the word up to the onset", () => {
    const [word] = fitWordsToSound(
      [{ text: "late", start: 1.6, end: 2.4 }],
      sound,
    );
    expect(word!.start).toBeGreaterThanOrEqual(1.95);
    expect(word!.start).toBeLessThanOrEqual(2.05);
  });

  it("keeps a word with no sound inside it as a very short one, in order", () => {
    const [word] = fitWordsToSound(
      [{ text: "hmm", start: 3, end: 3.5 }],
      sound,
    );
    expect(word!.end - word!.start).toBeLessThan(0.1);
  });
});

describe("a mouth that rests in pauses", () => {
  it("is shut during the silence between two words when the audio is given", async () => {
    const rate = 16000;
    const pcm = Buffer.alloc(rate * 2 * 3);
    // Sound 0.2 to 0.6 s and 2.2 to 2.6 s; silence between.
    for (const [from, to] of [
      [0.2, 0.6],
      [2.2, 2.6],
    ] as const)
      for (let i = Math.floor(from * rate); i < Math.floor(to * rate); i++)
        pcm.writeInt16LE(
          Math.round(Math.sin((2 * Math.PI * 300 * i) / rate) * 20000),
          i * 2,
        );
    const wav = pcmToWav(pcm, {
      sampleRate: rate,
      channels: 1,
      bitsPerSample: 16,
    });
    const track = await buildPresenterTrack({
      words: [
        { text: "Hello", start: 0.2, end: 2.2 },
        { text: "world", start: 2.2, end: 2.6 },
      ],
      wav,
      seconds: 3,
      seed: "t",
      language: "en",
    });
    const at = (t: number) =>
      track.mouth.find((k) => t >= k.start && t < k.end)?.viseme;
    // Shut all through the silence, moving while each word sounds.
    for (const t of [0.9, 1.2, 1.6, 1.95]) expect(at(t)).toBe("rest");
    expect(at(0.3)).not.toBe("rest");
    expect(at(2.3)).not.toBe("rest");
  });
});
