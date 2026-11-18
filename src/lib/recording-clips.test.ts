import { describe, expect, it } from "vitest";

import {
  fillerWordIndexes,
  planKeepSegments,
  remapWords,
  splitSentences,
  suggestClips,
  totalSeconds,
  type RecWord,
} from "./recording-clips";

/** Words of a talk: each word 0.3 s, a gap of `gap` seconds between sentences. */
function talk(sentences: string[], gap = 0.5): RecWord[] {
  const words: RecWord[] = [];
  let t = 0;
  for (const sentence of sentences) {
    for (const text of sentence.split(" ")) {
      words.push({ text, start: t, end: t + 0.3 });
      t += 0.35;
    }
    t += gap;
  }
  return words;
}

const long = (topic: string) =>
  `${topic} is a thing that matters a great deal for people who work with it every single day of the week`;

describe("sentences", () => {
  it("splits on punctuation and on long pauses", () => {
    const words = talk(["Hello there.", "Is it working?", "yes it is"], 0.2);
    const sentences = splitSentences(words);
    expect(sentences.map((s) => s.text)).toEqual([
      "Hello there.",
      "Is it working?",
      "yes it is",
    ]);
    expect(sentences[1]!.question).toBe(true);
    const gap = talk(["no punctuation here", "and then a long pause"], 1.5);
    expect(splitSentences(gap)).toHaveLength(2);
  });
});

describe("suggesting clips", () => {
  const sentences = Array.from({ length: 24 }, (_, i) =>
    i % 6 === 0 ? `Why does focus ${i} matter?` : long(`Focus ${i}`) + ".",
  );
  const words = talk(sentences);

  it("picks whole-sentence clips of the wanted length that do not overlap", () => {
    const clips = suggestClips(words, {
      minSeconds: 15,
      maxSeconds: 40,
      count: 3,
    });
    expect(clips).toHaveLength(3);
    for (const clip of clips) {
      expect(clip.seconds).toBeGreaterThanOrEqual(15);
      expect(clip.seconds).toBeLessThanOrEqual(40);
      expect(words[clip.startWord]!.start).toBe(clip.start);
      expect(
        words[clip.endWord]!.text.endsWith(".") ||
          words[clip.endWord]!.text.endsWith("?"),
      ).toBe(true);
    }
    const sorted = [...clips].sort((a, b) => a.start - b.start);
    sorted
      .slice(1)
      .forEach((clip, i) =>
        expect(clip.start).toBeGreaterThanOrEqual(sorted[i]!.end),
      );
  });

  it("is deterministic", () => {
    expect(suggestClips(words)).toEqual(suggestClips(words));
  });

  it("prefers a clip that opens with a question and avoids one that starts mid-thought", () => {
    const base = talk([
      "And that is why it works so well in practice for everyone who tries it at home tonight okay.",
      "Why is sleep so important for memory and for mood across a whole long week of work?",
      "Because the brain replays and sorts what it learned during the day while you rest deeply at night.",
      "Seven hours is the usual advice and most adults really do need about that much every night.",
    ]);
    const [best] = suggestClips(base, {
      minSeconds: 8,
      maxSeconds: 20,
      count: 1,
    });
    expect(base[best!.startWord]!.text).not.toBe("And");
    expect(best!.reasons.join(" ")).not.toContain("mid-thought");
  });

  it("uses audio energy when it is given", () => {
    const loud = suggestClips(words, {
      minSeconds: 15,
      maxSeconds: 40,
      count: 1,
      energy: (start) => (start > 100 ? 1 : 0),
    });
    expect(loud[0]!.start).toBeGreaterThan(90);
    expect(loud[0]!.reasons).toContain("energetic delivery");
  });

  it("returns nothing for an empty recording and trims long titles", () => {
    expect(suggestClips([])).toEqual([]);
    const [clip] = suggestClips(words, {
      minSeconds: 15,
      maxSeconds: 40,
      count: 1,
    });
    expect(clip!.title.length).toBeLessThanOrEqual(61);
  });
});

describe("cutting", () => {
  const words: RecWord[] = [
    { text: "So", start: 0, end: 0.3 },
    { text: "um", start: 0.4, end: 0.7 },
    { text: "this", start: 0.8, end: 1.1 },
    { text: "works.", start: 1.2, end: 1.6 },
    { text: "Really", start: 4.0, end: 4.4 },
    { text: "well.", start: 4.5, end: 4.9 },
  ];
  const range = { startWord: 0, endWord: 5 };

  it("finds filler sounds but keeps real words", () => {
    expect([...fillerWordIndexes(words)]).toEqual([1]);
    expect(fillerWordIndexes([{ text: "like", start: 0, end: 1 }]).size).toBe(
      0,
    );
  });

  it("keeps one segment when nothing is cut", () => {
    const segments = planKeepSegments(words, range);
    expect(segments).toHaveLength(1);
    expect(totalSeconds(segments)).toBeCloseTo(4.9 + 0.04 - 0, 1);
  });

  it("drops a long pause when trimming silence", () => {
    const segments = planKeepSegments(words, range, { trimSilence: true });
    expect(segments).toHaveLength(2);
    expect(segments[0]!.end).toBeLessThan(2);
    expect(segments[1]!.start).toBeGreaterThan(3.5);
    expect(totalSeconds(segments)).toBeLessThan(
      totalSeconds(planKeepSegments(words, range)) - 2,
    );
  });

  it("cuts out filler words and words the person deleted", () => {
    const segments = planKeepSegments(words, range, { removeFillers: true });
    expect(segments).toHaveLength(2);
    expect(segments[0]!.end).toBeLessThanOrEqual(0.4);
    expect(segments[1]!.start).toBeGreaterThanOrEqual(0.7);
    const deleted = planKeepSegments(words, range, {
      removed: new Set([4, 5]),
    });
    expect(deleted[deleted.length - 1]!.end).toBeLessThan(2);
  });

  it("moves the surviving words onto the new timeline", () => {
    const options = { removeFillers: true };
    const segments = planKeepSegments(words, range, options);
    const moved = remapWords(
      words,
      segments,
      range,
      new Set(fillerWordIndexes(words)),
    );
    expect(moved.map((w) => w.text)).toEqual([
      "So",
      "this",
      "works.",
      "Really",
      "well.",
    ]);
    expect(moved[0]!.start).toBeCloseTo(0.04 - 0.04, 1);
    // "this" follows "So" closely once "um" is gone.
    expect(moved[1]!.start - moved[0]!.end).toBeLessThan(0.3);
    expect(
      moved.every((w, i) => i === 0 || w.start >= moved[i - 1]!.start),
    ).toBe(true);
    expect(moved.at(-1)!.end).toBeLessThanOrEqual(
      totalSeconds(segments) + 0.01,
    );
  });
});
