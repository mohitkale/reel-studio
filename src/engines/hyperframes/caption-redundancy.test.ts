import { describe, expect, it } from "vitest";

import { redundantCaptionCueIds } from "@/engines/hyperframes/build-composition";

const cue = (id: string, startFrame: number, text: string) => ({
  id,
  startFrame,
  endFrame: startFrame + 20,
  text,
});
const base = {
  scenes: [
    {
      id: "a",
      templateId: "hf-statement",
      text: "Sleep is a skill.",
      emphasis: [],
    },
    {
      id: "b",
      templateId: "hf-statement",
      text: "Short headline",
      emphasis: [],
    },
  ],
  timeline: [
    { sceneId: "a", startFrame: 0, durationFrames: 60 },
    { sceneId: "b", startFrame: 60, durationFrames: 90 },
  ],
};

describe("redundantCaptionCueIds", () => {
  it("hides cues that repeat the on-screen headline, ignoring case and punctuation", () => {
    const hidden = redundantCaptionCueIds({
      ...base,
      captions: {
        enabled: true,
        timingSource: "estimated",
        cues: [
          cue("1", 0, "sleep is"),
          cue("2", 20, "a skill"),
          cue("3", 60, "Most adults need seven hours."),
        ],
      },
    } as never);
    expect([...hidden].sort()).toEqual(["1", "2"]);
  });

  it("keeps captions that show the narration rather than the headline", () => {
    const hidden = redundantCaptionCueIds({
      ...base,
      captions: {
        enabled: true,
        timingSource: "estimated",
        cues: [
          cue("1", 0, "Sleep is a skill you can practise."),
          cue("2", 60, "Short headline plus more words"),
        ],
      },
    } as never);
    expect(hidden.size).toBe(0);
  });

  it("does nothing without captions", () => {
    expect(redundantCaptionCueIds({ ...base } as never).size).toBe(0);
  });
});
