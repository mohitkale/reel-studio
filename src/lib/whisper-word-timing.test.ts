import { expect, it } from "vitest";
import { attachWhisperWordTiming } from "@/lib/whisper-word-timing";
const cues = [{ text: "Remarkable motion!", startFrame: 5, endFrame: 50 }];
const segment = {
  text: " Remarkable motion!",
  offsets: { from: 250, to: 2500 },
  tokens: [
    { text: "[_BEG_]" },
    { text: " Re", offsets: { from: 250, to: 450 } },
    { text: "markable", offsets: { from: 450, to: 900 } },
    { text: " motion", offsets: { from: 1200, to: 2100 } },
    { text: "!", offsets: { from: 2100, to: 2200 } },
    { text: "[_EOT_]" },
  ],
};
it("merges measured subword tokens and punctuation without filling speech gaps", () => {
  expect(
    attachWhisperWordTiming(cues, { transcription: [segment] }, 20)[0].words,
  ).toEqual([
    { text: "Remarkable", startFrame: 5, endFrame: 18 },
    { text: "motion!", startFrame: 24, endFrame: 44 },
  ]);
});
it("keeps SRT usable when tokens are absent, invalid, incomplete or unmatched", () => {
  expect(attachWhisperWordTiming(cues, {}, 20)).toEqual(cues);
  expect(
    attachWhisperWordTiming(
      cues,
      { transcription: [{ ...segment, text: "other" }] },
      20,
    ),
  ).toEqual(cues);
  expect(
    attachWhisperWordTiming(
      cues,
      {
        transcription: [
          {
            ...segment,
            tokens: [
              { text: " Re" },
              { text: "markable", offsets: { from: 500, to: 900 } },
            ],
          },
        ],
      },
      20,
    ),
  ).toEqual(cues);
  expect(
    attachWhisperWordTiming(
      cues,
      {
        transcription: [
          {
            ...segment,
            tokens: [{ text: " motion", offsets: { from: -1, to: 3000 } }],
          },
        ],
      },
      20,
    ),
  ).toEqual(cues);
});
