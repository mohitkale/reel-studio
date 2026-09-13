import { describe, expect, it } from "vitest";

import {
  podcastChaptersJson,
  podcastTranscriptText,
} from "@/library/podcast-transcript";
import type { PodcastTakeDTO } from "@/lib/dto";

const take = {
  id: "take",
  podcastId: "podcast",
  label: null,
  providerId: "kokoro-server",
  voiceId: "voice",
  modelId: null,
  fps: 30,
  totalFrames: 120,
  timeline: [
    {
      turnId: "turn",
      startFrame: 45,
      durationFrames: 60,
      text: "A grounded point.",
      characterKey: "host",
    },
  ],
  chapters: [
    {
      id: "chapter-1",
      title: "Opening",
      startFrame: 45,
      endFrame: 105,
      startTurnId: "turn",
      endTurnId: "turn",
    },
  ],
  voices: [],
  audioUrl: "/media/take.wav",
  mp3Url: null,
  createdAt: "2026-09-12T00:00:00.000Z",
} satisfies PodcastTakeDTO;

describe("podcast text exports", () => {
  it("exports timestamped speaker turns and machine-readable chapters", () => {
    const transcript = podcastTranscriptText(
      {
        title: "Episode",
        characters: [
          {
            id: "host-id",
            podcastId: "podcast",
            key: "host",
            name: "Maya",
            gender: "female",
            definition: "",
            providerId: "",
            voiceId: "",
            modelId: null,
            order: 0,
          },
        ],
      },
      take,
    );
    expect(transcript).toContain("[00:00:01] Maya\nA grounded point.");
    expect(JSON.parse(podcastChaptersJson(take))).toMatchObject({
      version: 1,
      chapters: [{ title: "Opening", startSeconds: 1.5, endSeconds: 3.5 }],
    });
  });
});
