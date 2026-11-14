import { describe, expect, it } from "vitest";

import { buildAutoCaptionTrack } from "./auto-captions";
import { contactSheetTimes } from "./contact-sheet";

const take = (timeline: unknown[]) =>
  ({
    id: "take-1",
    scriptId: "s",
    label: null,
    providerId: "kokoro-server",
    voiceId: "af_heart",
    modelId: null,
    fps: 30,
    totalFrames: 300,
    timeline,
    audioUrl: "/media/a.wav",
    isPlaceholder: false,
    source: "oneshot",
    createdAt: "2026-11-13T00:00:00.000Z",
  }) as never;

describe("buildAutoCaptionTrack", () => {
  it("splits narration into short cues with proportional timing when words are missing", () => {
    const track = buildAutoCaptionTrack({
      scriptId: "s",
      take: take([
        {
          sceneId: "a",
          startFrame: 0,
          durationFrames: 120,
          text: "Most adults need seven to nine hours of sleep. Treat it like training, not luck.",
        },
      ]),
    })!;
    expect(track.timingSource).toBe("estimated");
    expect(track.enabled).toBe(true);
    expect(track.cues.length).toBeGreaterThan(1);
    for (const cue of track.cues) {
      expect(cue.text.split(" ").length).toBeLessThanOrEqual(10);
      expect(cue.endFrame).toBeGreaterThan(cue.startFrame);
    }
    expect(track.cues[0]!.startFrame).toBe(0);
    expect(track.cues.at(-1)!.endFrame).toBe(120);
    for (let i = 1; i < track.cues.length; i++) {
      expect(track.cues[i]!.startFrame).toBeGreaterThanOrEqual(
        track.cues[i - 1]!.endFrame,
      );
    }
  });

  it("uses measured word timing when it matches the spoken text", () => {
    const words = "One two three four".split(" ").map((text, i) => ({
      text,
      startFrame: 10 + i * 10,
      endFrame: 20 + i * 10,
    }));
    const track = buildAutoCaptionTrack({
      scriptId: "s",
      take: take([
        {
          sceneId: "a",
          startFrame: 0,
          durationFrames: 60,
          text: "One two three four",
          words,
        },
      ]),
    })!;
    expect(track.timingSource).toBe("provider");
    expect(track.cues[0]).toMatchObject({ startFrame: 10, endFrame: 50 });
    expect(track.cues[0]!.words).toHaveLength(4);
  });

  it("is deterministic and returns null for silence", () => {
    const t = take([
      {
        sceneId: "a",
        startFrame: 0,
        durationFrames: 30,
        text: "Same text every time here.",
      },
    ]);
    expect(buildAutoCaptionTrack({ scriptId: "s", take: t })).toEqual(
      buildAutoCaptionTrack({ scriptId: "s", take: t }),
    );
    expect(
      buildAutoCaptionTrack({
        scriptId: "s",
        take: take([
          { sceneId: "a", startFrame: 0, durationFrames: 30, text: "  " },
        ]),
      }),
    ).toBeNull();
  });
});

describe("contactSheetTimes", () => {
  it("picks a moment inside every scene and never past the end", () => {
    const times = contactSheetTimes(
      [
        { startFrame: 0, durationFrames: 90 },
        { startFrame: 90, durationFrames: 90 },
      ],
      30,
      6,
    );
    expect(times).toEqual([1.2, 4.2]);
    expect(
      contactSheetTimes([{ startFrame: 150, durationFrames: 30 }], 30, 5.2)[0],
    ).toBeCloseTo(5.1, 5);
  });
});

describe("estimated word timing and the pop style", () => {
  it("spreads a cue over its words by length, covering it exactly", async () => {
    const { estimateWordTimes } = await import("./auto-captions");
    const words = estimateWordTimes(["Go", "far", "beyond"], 10, 40);
    expect(words[0]!.startFrame).toBe(10);
    expect(words[2]!.endFrame).toBe(40);
    for (let i = 1; i < words.length; i++)
      expect(words[i]!.startFrame).toBeGreaterThanOrEqual(
        words[i - 1]!.startFrame,
      );
    expect(words[2]!.endFrame - words[2]!.startFrame).toBeGreaterThan(
      words[0]!.endFrame - words[0]!.startFrame,
    );
  });
});
