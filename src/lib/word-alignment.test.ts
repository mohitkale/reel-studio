import { describe, expect, it } from "vitest";

import { alignSceneWords, heardWordsFromWhisperJson } from "./word-alignment";

describe("heardWordsFromWhisperJson", () => {
  it("joins subword tokens and skips markers", () => {
    const words = heardWordsFromWhisperJson({
      transcription: [
        {
          tokens: [
            { text: "[_BEG_]", offsets: { from: 0 } },
            { text: " Con", offsets: { from: 300 } },
            { text: "trol", offsets: { from: 420 } },
            { text: " key", offsets: { from: 700 } },
            { text: ".", offsets: { from: 900 } },
            { text: "[_TT_50]", offsets: { from: 1000 } },
          ],
        },
      ],
    });
    expect(words).toEqual([
      { text: "Control", ms: 300 },
      { text: "key.", ms: 700 },
    ]);
  });

  it("tolerates output it does not understand", () => {
    expect(heardWordsFromWhisperJson(null)).toEqual([]);
    expect(heardWordsFromWhisperJson({ transcription: 5 })).toEqual([]);
  });
});

describe("alignSceneWords", () => {
  const heard = [
    { text: "Most", ms: 300 },
    { text: "people", ms: 700 },
    { text: "lose", ms: 1100 },
    { text: "hours", ms: 1500 },
  ];
  const base = {
    heard,
    from: 0,
    fps: 30,
    sceneStartFrame: 0,
    sceneEndFrame: 90,
  };

  it("times each word from where it was heard", () => {
    const aligned = alignSceneWords({
      ...base,
      words: ["Most", "people", "lose", "hours."],
    })!;
    expect(aligned.words.map((w) => w.startFrame)).toEqual([9, 21, 33, 45]);
    expect(aligned.words[0]!.endFrame).toBe(21);
    expect(aligned.next).toBe(4);
  });

  it("places a missed word between its neighbours", () => {
    const aligned = alignSceneWords({
      ...base,
      words: ["Most", "of", "people", "lose", "hours"],
      minMatched: 0.7,
    })!;
    const starts = aligned.words.map((w) => w.startFrame);
    expect(starts[1]).toBeGreaterThan(starts[0]!);
    expect(starts[1]).toBeLessThan(starts[2]!);
  });

  it("gives up when too few words were heard", () => {
    expect(
      alignSceneWords({
        ...base,
        words: ["Quite", "another", "sentence", "now"],
      }),
    ).toBeNull();
  });

  it("moves a word that starts in a pause to the next speech", () => {
    const aligned = alignSceneWords({
      ...base,
      words: ["Most", "people", "lose", "hours"],
      spans: [
        [0.6, 0.9],
        [1.0, 2.0],
      ],
    })!;
    // "Most" at 0.3 s is in silence; speech starts at 0.6 s.
    expect(aligned.words[0]!.startFrame).toBe(18);
  });
});
