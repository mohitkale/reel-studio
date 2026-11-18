import { describe, expect, it } from "vitest";

import {
  VISEMES,
  accentTrack,
  amplitudeTrack,
  blinkTrack,
  mouthTrack,
  phonemesToVisemes,
} from "./visemes";

describe("visemes", () => {
  it("has twelve mouth shapes", () => {
    expect(VISEMES).toHaveLength(12);
    expect(new Set(VISEMES).size).toBe(12);
  });

  it("maps IPA to shapes and holds vowels longer than stops", () => {
    const hello = phonemesToVisemes("həlˈoʊ");
    expect(hello.map((p) => p.viseme)).toEqual(["eh", "l", "oh", "oo"]);
    const map = phonemesToVisemes("mɑp").map((p) => p.viseme);
    expect(map).toEqual(["mbp", "ah", "mbp"]);
    const [stop, vowel] = phonemesToVisemes("pɑ");
    expect(vowel!.weight).toBeGreaterThan(stop!.weight);
    expect(phonemesToVisemes("fɔɹ").map((p) => p.viseme)).toEqual([
      "fv",
      "oh",
      "r",
    ]);
    expect(phonemesToVisemes("ʃiː").map((p) => p.viseme)).toEqual(["sh", "ee"]);
    expect(phonemesToVisemes("ˈ ː")).toEqual([]);
  });

  it("merges neighbours with the same shape", () => {
    expect(phonemesToVisemes("mm").map((p) => p.viseme)).toEqual(["mbp"]);
  });
});

describe("mouth track", () => {
  const words = [
    { text: "mama", start: 0.2, end: 0.6 },
    { text: "go", start: 1.0, end: 1.4 },
  ];
  const ipa = (w: string) => ({ mama: "mˈɑːmə", go: "ɡˈoʊ" })[w];

  it("divides each word among its phonemes and rests between words", () => {
    const track = mouthTrack(words, ipa);
    expect(track[0]).toMatchObject({ viseme: "rest", start: 0 });
    const inWord = track.filter((k) => k.start >= 0.2 && k.end <= 0.6);
    expect(inWord.map((k) => k.viseme)).toEqual(["mbp", "ah", "mbp", "eh"]);
    expect(inWord[0]!.start).toBeCloseTo(0.2);
    expect(inWord.at(-1)!.end).toBeCloseTo(0.6);
    expect(
      track.some(
        (k) => k.viseme === "rest" && k.start >= 0.59 && k.end <= 1.01,
      ),
    ).toBe(true);
  });

  it("covers the speech without gaps or overlaps and is deterministic", () => {
    const track = mouthTrack(words, ipa);
    track
      .slice(1)
      .forEach((key, i) =>
        expect(key.start).toBeGreaterThanOrEqual(track[i]!.end - 1e-9),
      );
    expect(mouthTrack(words, ipa)).toEqual(track);
    expect(
      track.every((k) => k.end - k.start >= 0.049 || k === track.at(-1)),
    ).toBe(true);
  });

  it("follows loudness for a word it has no phonemes for", () => {
    const loud = mouthTrack(
      [{ text: "नमस्ते", start: 0, end: 0.4 }],
      () => undefined,
      () => 0.9,
    );
    expect(loud.every((k) => k.viseme === "ah")).toBe(true);
    const quiet = mouthTrack(
      [{ text: "नमस्ते", start: 0, end: 0.4 }],
      () => undefined,
      () => 0.05,
    );
    expect(quiet.every((k) => k.viseme === "rest")).toBe(true);
  });

  it("makes an amplitude-only track", () => {
    const track = amplitudeTrack((t) => (t < 1 ? 0.9 : 0), 2);
    expect(track[0]!.viseme).toBe("ah");
    expect(track.at(-1)!.viseme).toBe("rest");
    expect(track.at(-1)!.end).toBeCloseTo(2);
  });
});

describe("blinks and accents", () => {
  it("blinks at steady, seeded intervals", () => {
    const blinks = blinkTrack(30, 7);
    expect(blinks.length).toBeGreaterThan(5);
    blinks
      .slice(1)
      .forEach((b, i) =>
        expect(b.start - blinks[i]!.start).toBeGreaterThanOrEqual(2.5),
      );
    expect(blinkTrack(30, 7)).toEqual(blinks);
    expect(blinkTrack(30, 8)).not.toEqual(blinks);
  });

  it("nods on emphasis and raises brows on a question, not too often", () => {
    const words = [
      { text: "Never", start: 1, end: 1.3 },
      { text: "skip", start: 1.4, end: 1.6 },
      { text: "sleep", start: 1.7, end: 2 },
      { text: "ever?", start: 2.1, end: 2.5 },
      { text: "Always", start: 2.6, end: 2.9 },
    ];
    const accents = accentTrack(words);
    expect(accents.filter((a) => a.kind === "brows")).toHaveLength(1);
    expect(accents.filter((a) => a.kind === "nod").length).toBeLessThanOrEqual(
      2,
    );
  });
});
