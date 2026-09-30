import { describe, expect, it } from "vitest";
import type { CaptionTrackDTO } from "@/lib/dto";
import { LEGACY_CAPTION_STYLE } from "@/lib/caption-style";
import { resolveSpokenWordWindows } from "@/lib/spoken-word-windows";

const track: CaptionTrackDTO = {
  id: "caption",
  scriptId: "script",
  label: "Measured",
  language: "en",
  enabled: false,
  timingSource: "local-transcription",
  sourceTakeId: "audible",
  sourceFps: 30,
  style: LEGACY_CAPTION_STYLE,
  updatedAt: "2026-09-30T00:00:00Z",
  cues: [
    {
      id: "cue",
      order: 0,
      startFrame: 0,
      endFrame: 90,
      text: "A clear voice",
      words: [
        { text: "A", startFrame: 3, endFrame: 10 },
        { text: "clear", startFrame: 15, endFrame: 29 },
        { text: "voice", startFrame: 35, endFrame: 51 },
      ],
    },
  ],
};

describe("measured narration windows", () => {
  it("uses matching measured words even when captions are hidden", () => {
    expect(resolveSpokenWordWindows([track], "audible", 30)).toEqual([
      { startFrame: 3, endFrame: 10 },
      { startFrame: 15, endFrame: 29 },
      { startFrame: 35, endFrame: 51 },
    ]);
  });
  it("ignores unknown, mismatched, estimated and imported timing", () => {
    expect(resolveSpokenWordWindows([track], null, 30)).toEqual([]);
    expect(resolveSpokenWordWindows([track], "other", 30)).toEqual([]);
    expect(resolveSpokenWordWindows([track], "audible", 60)).toEqual([]);
    for (const timingSource of ["estimated", "imported"] as const)
      expect(
        resolveSpokenWordWindows([{ ...track, timingSource }], "audible", 30),
      ).toEqual([]);
    expect(
      resolveSpokenWordWindows(
        [{ ...track, sourceTakeId: null }],
        "audible",
        30,
      ),
    ).toEqual([]);
  });
  it("rejects invalid words and never uses a scene-length estimate as speech", () => {
    const invalid: CaptionTrackDTO = {
      ...track,
      cues: [
        {
          ...track.cues[0],
          words: [
            { text: "", startFrame: 3, endFrame: 10 },
            { text: "bad", startFrame: 50, endFrame: 40 },
            { text: "outside", startFrame: 80, endFrame: 100 },
            { text: "nan", startFrame: NaN, endFrame: 30 },
          ],
        },
      ],
    };
    expect(resolveSpokenWordWindows([invalid], "audible", 30)).toEqual([]);
    expect(
      resolveSpokenWordWindows(
        [{ ...track, cues: [{ ...track.cues[0], words: undefined }] }],
        "audible",
        30,
      ),
    ).toEqual([]);
  });
});
