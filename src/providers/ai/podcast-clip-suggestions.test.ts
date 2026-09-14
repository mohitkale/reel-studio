import { describe, expect, it } from "vitest";

import type { PodcastTakeDTO } from "@/lib/dto";
import {
  deterministicPodcastClipSuggestions,
  groundPodcastClipSuggestions,
} from "@/providers/ai/podcast-clip-suggestions";

const take = {
  id: "take",
  podcastId: "podcast",
  label: null,
  providerId: "kokoro-server",
  voiceId: "voice",
  modelId: null,
  fps: 30,
  totalFrames: 1_800,
  timeline: [
    {
      turnId: "a",
      startFrame: 0,
      durationFrames: 300,
      text: "This exact opening stays grounded.",
      characterKey: "host",
    },
    {
      turnId: "b",
      startFrame: 315,
      durationFrames: 330,
      text: "The transcript provides the displayed quote.",
      characterKey: "guest",
    },
    {
      turnId: "c",
      startFrame: 660,
      durationFrames: 300,
      text: "This is the final saved turn.",
      characterKey: "host",
    },
  ],
  chapters: [],
  voices: [],
  finishing: null,
  audioUrl: "/media/take.wav",
  mp3Url: null,
  createdAt: "2026-09-14T00:00:00.000Z",
} satisfies PodcastTakeDTO;

describe("podcast clip suggestions", () => {
  it("derives quotes and timestamps only from the selected transcript range", () => {
    const [suggestion] = groundPodcastClipSuggestions(take, [
      {
        startTurnId: "a",
        endTurnId: "b",
        label: "Strong exchange",
        reason: "Provider-authored rationale",
      },
    ]);
    expect(suggestion).toMatchObject({
      startSeconds: 0,
      endSeconds: 21.5,
      durationSeconds: 21.5,
      selectedTurnIds: ["a", "b"],
      quote:
        "This exact opening stays grounded. The transcript provides the displayed quote.",
    });
  });

  it("rejects unknown, reversed, duplicate, and overlong provider ranges", () => {
    expect(() =>
      groundPodcastClipSuggestions(take, [
        { startTurnId: "missing", endTurnId: "b", label: "Invalid" },
      ]),
    ).toThrow("outside this take");
    expect(() =>
      groundPodcastClipSuggestions(take, [
        { startTurnId: "c", endTurnId: "a", label: "Invalid" },
      ]),
    ).toThrow("must follow");
    expect(() =>
      groundPodcastClipSuggestions(take, [
        { startTurnId: "a", endTurnId: "b", label: "One" },
        { startTurnId: "a", endTurnId: "b", label: "Two" },
      ]),
    ).toThrow("distinct");
    expect(() =>
      groundPodcastClipSuggestions(
        {
          ...take,
          timeline: [{ ...take.timeline[0], durationFrames: 2_701 }],
        },
        [{ startTurnId: "a", endTurnId: "a", label: "Too long" }],
      ),
    ).toThrow("between 1 and 90 seconds");
  });

  it("provides timestamped local choices without an AI provider", () => {
    const suggestions = deterministicPodcastClipSuggestions(take);
    expect(suggestions.length).toBeGreaterThan(0);
    expect(suggestions.every((item) => item.quote.length > 0)).toBe(true);
    expect(suggestions.every((item) => item.durationSeconds <= 90)).toBe(true);
  });
});
