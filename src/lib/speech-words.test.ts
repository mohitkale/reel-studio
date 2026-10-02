import { describe, expect, it } from "vitest";
import {
  characterAlignmentSchema,
  characterAlignmentWords,
  speechWordsMatchText,
  speechWordsSchema,
} from "./speech-words";
import { stitchBeats } from "./audio-timing";
import { makeSilentWav } from "./wav";
import { timelineSchema } from "@/library/schemas";
import { podcastTimelineSchema } from "@/library/podcast-schemas";

describe("measured speech words", () => {
  it("converts Unicode character alignment and rejects malformed timing", () => {
    const characters = [..."Hi 世界!"];
    const alignment = {
      characters,
      character_start_times_seconds: characters.map((_, i) => i / 10),
      character_end_times_seconds: characters.map((_, i) => (i + 1) / 10),
    };
    expect(characterAlignmentWords(alignment)).toEqual([
      { text: "Hi", startSeconds: 0, endSeconds: 0.2 },
      { text: "世界", startSeconds: 0.3, endSeconds: 0.5 },
    ]);
    expect(
      characterAlignmentSchema.safeParse({ ...alignment, characters: [] })
        .success,
    ).toBe(false);
    expect(
      speechWordsSchema.safeParse([
        { text: "Hi", startSeconds: 1, endSeconds: 0.2 },
      ]).success,
    ).toBe(false);
  });
  it("preserves sample-derived beat offsets, gaps and persisted timelines", () => {
    const words = [{ text: "Hello", startSeconds: 0.1, endSeconds: 0.4 }];
    const stitched = stitchBeats(
      [
        { sceneId: "a", text: "Hello", wav: makeSilentWav(1), words },
        { sceneId: "b", text: "Hello", wav: makeSilentWav(1), words },
      ],
      30,
      0.5,
    );
    expect(stitched.timeline.map((beat) => beat.words)).toEqual([
      [{ text: "Hello", startFrame: 3, endFrame: 12 }],
      [{ text: "Hello", startFrame: 48, endFrame: 57 }],
    ]);
    expect(
      timelineSchema.parse(JSON.parse(JSON.stringify(stitched.timeline))),
    ).toEqual(stitched.timeline);
    const podcast = stitched.timeline.map((beat) => ({
      ...beat,
      turnId: beat.sceneId,
      characterKey: "host",
      startFrame: beat.startFrame + 60,
      words: beat.words?.map((word) => ({
        ...word,
        startFrame: word.startFrame + 60,
        endFrame: word.endFrame + 60,
      })),
    }));
    expect(podcastTimelineSchema.parse(podcast)[1].words?.[0].startFrame).toBe(
      108,
    );
  });
  it("checks a known script without pretending to acoustically align it", () => {
    expect(
      speechWordsMatchText("Hello, WORLD!", [
        { text: "hello" },
        { text: "world" },
      ]),
    ).toBe(true);
    expect(speechWordsMatchText("Hello world", [{ text: "Hello" }])).toBe(
      false,
    );
    expect(
      speechWordsMatchText("42 things", [
        { text: "forty" },
        { text: "two" },
        { text: "things" },
      ]),
    ).toBe(false);
  });
});
