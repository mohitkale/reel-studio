import { describe, expect, it } from "vitest";
import type { ScriptDTO, VoiceTakeDTO } from "@/lib/dto";
import {
  cutSuggestionRequestSchema,
  suggestNarrationCuts,
} from "./cut-suggestions";
const take = {
  id: "take",
  fps: 30,
  isPlaceholder: false,
  totalFrames: 210,
  timeline: [
    { sceneId: "a", text: "One", startFrame: 0, durationFrames: 90 },
    { sceneId: "b", text: "Two", startFrame: 94, durationFrames: 116 },
  ],
} as VoiceTakeDTO;
const fixture = () =>
  ({
    scenes: [
      { id: "a", text: "One", spokenText: null },
      { id: "b", text: "Two", spokenText: null },
    ],
    musicUrl: "/music/a.wav",
    musicMap: {
      version: 1,
      sourceUrl: "/music/a.wav",
      sourceHash: "a".repeat(64),
      durationSeconds: 4,
      bpm: 120,
      offsetSeconds: 0,
      confidence: 0.8,
      method: "manual",
      disabledBeats: [],
      dropSeconds: null,
    },
    captionTracks: [
      {
        sourceTakeId: "take",
        sourceFps: 30,
        timingSource: "provider",
        enabled: false,
        cues: [
          {
            startFrame: 0,
            endFrame: 210,
            words: [
              { text: "One", startFrame: 0, endFrame: 80 },
              { text: "Two", startFrame: 105, endFrame: 210 },
            ],
          },
        ],
      },
    ],
  }) as unknown as ScriptDTO;
describe("narration-aware advisory cuts", () => {
  it("uses measured words even with captions hidden, without mutating timing", () => {
    const script = fixture();
    const before = JSON.stringify([script, take]);
    expect(suggestNarrationCuts(script, take).suggestions).toEqual([
      { sceneId: "b", fromFrame: 94, toFrame: 90, anchor: "beat" },
    ]);
    expect(JSON.stringify([script, take])).toBe(before);
  });
  it("protects speech plus 80ms clearance, reading holds and locks", () => {
    const script = fixture();
    script.captionTracks![0].cues[0].words![0].endFrame = 89;
    expect(suggestNarrationCuts(script, take).suggestions).toEqual([]);
    const locked = fixture();
    locked.scenes[1].locks = { scene: true, copy: false, assets: false };
    expect(suggestNarrationCuts(locked, take).suggestions).toEqual([]);
    const dense = fixture();
    dense.scenes[0].text = "Long reading copy ".repeat(10);
    dense.scenes[0].spokenText = "One";
    expect(suggestNarrationCuts(dense, take).suggestions).toEqual([]);
  });
  it("requires matching take and native word provenance, including coverage on both sides", () => {
    for (const field of [
      "sourceTakeId",
      "sourceFps",
      "timingSource",
    ] as const) {
      const script = fixture();
      Object.assign(script.captionTracks![0], {
        [field]: field === "sourceFps" ? 60 : "imported",
      });
      expect(suggestNarrationCuts(script, take).suggestions).toEqual([]);
    }
    const script = fixture();
    script.captionTracks![0].cues[0].words!.pop();
    expect(suggestNarrationCuts(script, take).suggestions).toEqual([]);
    script.scenes[0].spokenText = "Changed voice";
    expect(suggestNarrationCuts(script, take).suggestions).toEqual([]);
    expect(
      suggestNarrationCuts(fixture(), { ...take, isPlaceholder: true })
        .suggestions,
    ).toEqual([]);
  });
  it("honors disabled beats, explicit drops, cover offsets and loops", () => {
    const script = fixture();
    script.musicMap!.disabledBeats = [6];
    expect(suggestNarrationCuts(script, take).suggestions).toEqual([]);
    script.musicMap!.dropSeconds = 3;
    expect(suggestNarrationCuts(script, take).suggestions[0].anchor).toBe(
      "drop",
    );
    script.coverUrl = "/media/cover.png";
    expect(
      suggestNarrationCuts(script, take).suggestions[0].toFrame,
    ).toBeGreaterThan(90);
    const loop = fixture();
    loop.musicMap!.durationSeconds = 2;
    expect(suggestNarrationCuts(loop, take).suggestions[0].toFrame).toBe(90);
  });
  it("requires explicit map review and bounds external requests", () => {
    expect(
      cutSuggestionRequestSchema.safeParse({
        takeId: "take",
        reviewed: false,
        expectedMusicMap: fixture().musicMap,
      }).success,
    ).toBe(false);
    expect(
      cutSuggestionRequestSchema.safeParse({
        takeId: "take",
        reviewed: true,
        expectedMusicMap: fixture().musicMap,
      }).success,
    ).toBe(true);
  });
});
