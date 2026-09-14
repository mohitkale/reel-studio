import { describe, expect, it } from "vitest";

import { pcmToWav, parseWav } from "@/lib/wav";
import { buildPodcastAudiogramPlan } from "@/library/podcast-audiogram";
import type { PodcastDTO, PodcastTakeDTO } from "@/lib/dto";

function sourceWav(seconds: number): Buffer {
  const samples = 44_100 * seconds;
  const pcm = Buffer.alloc(samples * 2);
  for (let i = 0; i < samples; i += 1) {
    pcm.writeInt16LE(
      Math.round(Math.sin((i / 44_100) * Math.PI * 440) * 8000),
      i * 2,
    );
  }
  return pcmToWav(pcm);
}

const podcast = {
  id: "podcast",
  title: "Useful conversations",
  description: "",
  length: "short",
  presetId: "interview",
  introMusicAssetId: null,
  outroMusicAssetId: null,
  introMusic: null,
  outroMusic: null,
  pronunciations: [],
  characters: [
    {
      id: "character",
      podcastId: "podcast",
      key: "host",
      name: "Maya",
      gender: "female",
      definition: "",
      providerId: "kokoro-server",
      voiceId: "af_bella",
      modelId: null,
      order: 0,
    },
  ],
  turns: [],
  takes: [],
  createdAt: "2026-09-12T00:00:00.000Z",
  updatedAt: "2026-09-12T00:00:00.000Z",
} satisfies PodcastDTO;

const take = {
  id: "take",
  podcastId: "podcast",
  label: "Take",
  providerId: "kokoro-server",
  voiceId: "af_bella",
  modelId: null,
  fps: 30,
  totalFrames: 180,
  timeline: [
    {
      turnId: "a",
      startFrame: 0,
      durationFrames: 60,
      text: "First",
      characterKey: "host",
    },
    {
      turnId: "b",
      startFrame: 75,
      durationFrames: 60,
      text: "Second",
      characterKey: "host",
    },
    {
      turnId: "c",
      startFrame: 150,
      durationFrames: 30,
      text: "Third",
      characterKey: "host",
    },
  ],
  chapters: [],
  voices: [],
  finishing: null,
  audioUrl: "/media/take.wav",
  mp3Url: null,
  createdAt: "2026-09-12T00:00:00.000Z",
} satisfies PodcastTakeDTO;

describe("podcast audiogram planning", () => {
  it("cuts a contiguous selection and keeps its original samples", () => {
    const plan = buildPodcastAudiogramPlan({
      podcast,
      take,
      sourceWav: sourceWav(6),
      selection: { startTurnId: "b", endTurnId: "c", orientation: "square" },
    });
    expect(plan.selectedTurnIds).toEqual(["b", "c"]);
    expect(plan.props).toMatchObject({
      width: 1080,
      height: 1080,
      presetLabel: "Interview",
      durationInFrames: 105,
    });
    expect(plan.props.beats[0]).toMatchObject({
      speaker: "Maya",
      startFrame: 0,
    });
    expect(parseWav(plan.wav).durationSeconds).toBeCloseTo(3.5, 2);
    expect(plan.props.waveform.some((level) => level > 0.1)).toBe(true);
  });

  it("rejects reverse and overlong selections", () => {
    expect(() =>
      buildPodcastAudiogramPlan({
        podcast,
        take,
        sourceWav: sourceWav(6),
        selection: {
          startTurnId: "c",
          endTurnId: "a",
          orientation: "portrait",
        },
      }),
    ).toThrow("must follow");
    const longTake = {
      ...take,
      totalFrames: 3_300,
      timeline: [{ ...take.timeline[0], durationFrames: 3_300 }],
    };
    expect(() =>
      buildPodcastAudiogramPlan({
        podcast,
        take: longTake,
        sourceWav: sourceWav(110),
        selection: {
          startTurnId: "a",
          endTurnId: "a",
          orientation: "portrait",
        },
      }),
    ).toThrow("90 seconds");
  });
});
